//! Windows: Bluetooth дистанционни (Mi Remote за Mi TV Box и подобни) пращат кръстачката и OK
//! като HID кодове от страницата „Consumer“ (Menu Up/Down/Left/Right/Pick). Android ги превръща
//! в стрелки и Enter, а Windows – не (там работят само звукът и медийните бутони).
//! Тук ги четем през Raw Input и ги подаваме на страницата като имена на клавиши.

/// име на клавиша за код от страницата Consumer (0x0C)
pub fn key_for(usage: u16) -> Option<&'static str> {
    match usage {
        0x41 => Some("Enter"),      // Menu Pick (OK)
        0x42 => Some("ArrowUp"),    // Menu Up
        0x43 => Some("ArrowDown"),  // Menu Down
        0x44 => Some("ArrowLeft"),  // Menu Left
        0x45 => Some("ArrowRight"), // Menu Right
        _ => None,
    }
}

/// пуска слушането в отделна нишка; `emit(клавиш, натиснат)` се вика при натискане и пускане
#[cfg(windows)]
pub fn start<F>(emit: F)
where
    F: Fn(&'static str, bool) + Send + 'static,
{
    let _ = std::thread::Builder::new()
        .name("hid-remote".into())
        .spawn(move || unsafe { imp::run(Box::new(emit)) });
}

#[cfg(not(windows))]
pub fn start<F>(_emit: F)
where
    F: Fn(&'static str, bool) + Send + 'static,
{
}

#[cfg(windows)]
mod imp {
    use super::key_for;
    use std::cell::RefCell;
    use std::collections::{HashMap, HashSet};
    use std::mem::size_of;
    use windows::core::w;
    use windows::Win32::Devices::HumanInterfaceDevice::{
        HidP_GetUsages, HidP_Input, HIDP_STATUS_SUCCESS, PHIDP_PREPARSED_DATA,
    };
    use windows::Win32::Foundation::{HANDLE, HWND, LPARAM, LRESULT, WPARAM};
    use windows::Win32::System::LibraryLoader::GetModuleHandleW;
    use windows::Win32::System::Threading::GetCurrentProcessId;
    use windows::Win32::UI::Input::{
        GetRawInputData, GetRawInputDeviceInfoW, RegisterRawInputDevices, HRAWINPUT, RAWINPUT,
        RAWINPUTDEVICE, RAWINPUTHEADER, RIDEV_DEVNOTIFY, RIDEV_INPUTSINK, RIDI_PREPARSEDDATA,
        RID_INPUT, RIM_TYPEHID,
    };
    use windows::Win32::UI::WindowsAndMessaging::{
        CreateWindowExW, DefWindowProcW, DispatchMessageW, GetForegroundWindow, GetMessageW,
        GetWindowThreadProcessId, RegisterClassW, TranslateMessage, GIDC_REMOVAL, HWND_MESSAGE,
        MSG, WINDOW_EX_STYLE, WINDOW_STYLE, WM_INPUT, WM_INPUT_DEVICE_CHANGE, WNDCLASSW,
    };

    struct St {
        emit: Box<dyn Fn(&'static str, bool)>,
        /// описание на отчетите на всяко устройство (за HidP_GetUsages)
        prep: HashMap<isize, Vec<u64>>,
        /// натиснатите в момента бутони на всяко устройство
        down: HashMap<isize, HashSet<u16>>,
    }

    thread_local! {
        static ST: RefCell<Option<St>> = const { RefCell::new(None) };
    }

    pub unsafe fn run(emit: Box<dyn Fn(&'static str, bool) + Send>) {
        ST.with(|s| {
            *s.borrow_mut() = Some(St {
                emit,
                prep: HashMap::new(),
                down: HashMap::new(),
            })
        });
        let hinst = match GetModuleHandleW(None) {
            Ok(h) => h,
            Err(_) => return,
        };
        let cls = w!("TPromptHidRemote");
        let wc = WNDCLASSW {
            lpfnWndProc: Some(wndproc),
            hInstance: hinst.into(),
            lpszClassName: cls,
            ..Default::default()
        };
        if RegisterClassW(&wc) == 0 {
            return;
        }
        // невидим прозорец само за съобщения
        let hwnd = match CreateWindowExW(
            WINDOW_EX_STYLE(0),
            cls,
            w!(""),
            WINDOW_STYLE(0),
            0,
            0,
            0,
            0,
            Some(HWND_MESSAGE),
            None,
            Some(hinst.into()),
            None,
        ) {
            Ok(h) => h,
            Err(_) => return,
        };
        // Consumer Control (страница 0x0C, употреба 0x01); INPUTSINK – получава и когато прозорецът не е отпред,
        // затова по-долу проверяваме дали отпред е прозорец на TPrompt
        let rid = [RAWINPUTDEVICE {
            usUsagePage: 0x0C,
            usUsage: 0x01,
            dwFlags: RIDEV_INPUTSINK | RIDEV_DEVNOTIFY,
            hwndTarget: hwnd,
        }];
        if RegisterRawInputDevices(&rid, size_of::<RAWINPUTDEVICE>() as u32).is_err() {
            return;
        }
        let mut msg = MSG::default();
        while GetMessageW(&mut msg, None, 0, 0).as_bool() {
            let _ = TranslateMessage(&msg);
            DispatchMessageW(&msg);
        }
    }

    unsafe extern "system" fn wndproc(h: HWND, m: u32, wp: WPARAM, lp: LPARAM) -> LRESULT {
        match m {
            WM_INPUT => {
                on_input(HRAWINPUT(lp.0 as _));
                DefWindowProcW(h, m, wp, lp)
            }
            WM_INPUT_DEVICE_CHANGE => {
                if wp.0 as u32 == GIDC_REMOVAL {
                    on_removed(lp.0 as isize);
                }
                LRESULT(0)
            }
            _ => DefWindowProcW(h, m, wp, lp),
        }
    }

    /// отпред ли е прозорец на TPrompt (за да не управляваме приложението, докато се работи в друго)
    unsafe fn ours() -> bool {
        let fg = GetForegroundWindow();
        if fg.is_invalid() {
            return false;
        }
        let mut pid = 0u32;
        GetWindowThreadProcessId(fg, Some(&mut pid));
        pid == GetCurrentProcessId()
    }

    unsafe fn preparsed(dev: HANDLE) -> Option<Vec<u64>> {
        let mut sz = 0u32;
        GetRawInputDeviceInfoW(Some(dev), RIDI_PREPARSEDDATA, None, &mut sz);
        if sz == 0 {
            return None;
        }
        let mut v = vec![0u64; (sz as usize + 7) / 8];
        let r = GetRawInputDeviceInfoW(
            Some(dev),
            RIDI_PREPARSEDDATA,
            Some(v.as_mut_ptr() as *mut _),
            &mut sz,
        );
        if r == 0 || r == u32::MAX {
            return None;
        }
        Some(v)
    }

    unsafe fn on_input(hri: HRAWINPUT) {
        let hs = size_of::<RAWINPUTHEADER>() as u32;
        let mut sz = 0u32;
        GetRawInputData(hri, RID_INPUT, None, &mut sz, hs);
        if sz == 0 {
            return;
        }
        let mut buf = vec![0u64; (sz as usize + 7) / 8];
        let got = GetRawInputData(hri, RID_INPUT, Some(buf.as_mut_ptr() as *mut _), &mut sz, hs);
        if got == 0 || got == u32::MAX {
            return;
        }
        let ri = &*(buf.as_ptr() as *const RAWINPUT);
        if ri.header.dwType != RIM_TYPEHID.0 {
            return;
        }
        let dev = ri.header.hDevice;
        let id = dev.0 as isize;
        let hid = &ri.data.hid;
        let one = hid.dwSizeHid as usize;
        let cnt = hid.dwCount as usize;
        let base = hid.bRawData.as_ptr() as *mut u8;
        let start = base as usize - buf.as_ptr() as usize;
        if one == 0 || start + one * cnt > got as usize {
            return;
        }
        let fg = ours();
        ST.with(|s| {
            let mut s = s.borrow_mut();
            let st = match s.as_mut() {
                Some(st) => st,
                None => return,
            };
            if !st.prep.contains_key(&id) {
                match preparsed(dev) {
                    Some(p) => {
                        st.prep.insert(id, p);
                    }
                    None => return,
                }
            }
            let pp = PHIDP_PREPARSED_DATA(st.prep[&id].as_ptr() as isize);
            for i in 0..cnt {
                let rep = std::slice::from_raw_parts_mut(base.add(i * one), one);
                let mut list = [0u16; 32];
                let mut len = list.len() as u32;
                let r = HidP_GetUsages(HidP_Input, 0x0C, None, list.as_mut_ptr(), &mut len, pp, rep);
                if r != HIDP_STATUS_SUCCESS {
                    continue; // отчет без бутони от Consumer (друг номер на отчета)
                }
                let now: HashSet<u16> = list[..(len as usize).min(list.len())]
                    .iter()
                    .copied()
                    .filter(|u| key_for(*u).is_some())
                    .collect();
                let was = st.down.entry(id).or_default().clone();
                for u in was.difference(&now) {
                    if let Some(k) = key_for(*u) {
                        (st.emit)(k, false);
                    }
                }
                for u in now.difference(&was) {
                    if let Some(k) = key_for(*u) {
                        if fg {
                            (st.emit)(k, true);
                        }
                    }
                }
                st.down.insert(id, now);
            }
        });
    }

    /// изключено устройство: пускаме задържаните бутони и забравяме описанието му
    fn on_removed(id: isize) {
        ST.with(|s| {
            let mut s = s.borrow_mut();
            if let Some(st) = s.as_mut() {
                st.prep.remove(&id);
                if let Some(d) = st.down.remove(&id) {
                    for u in d {
                        if let Some(k) = key_for(u) {
                            (st.emit)(k, false);
                        }
                    }
                }
            }
        });
    }
}
