# Changelog

## 1.4.0 — 2026-11-22 08:45 (Europe/Sofia)

### Source code in parts
- The code is split into 57 parts in `source/src/` (styles, window markup, help, logic, Bulgarian translations, editor, test switcher). `source/build.py` assembles them into one `index.html`; the result was checked to be identical to the single file before the split.
- `index.html` in this zip is the release build (`build.py --release`), without the test switcher.

### Test switcher (only in the preview build, not in the release build)
- A small field bottom left switches between Browser, Windows and Android behaviour, for checking both interfaces in one browser.
- Placeholders instead of the QR code and the QR scanner camera; the connection address is fictitious, so devices do not actually connect in test mode.
- Android on a wide screen (computer): the page is shrunk to a phone screen (412×915, portrait).

### Top bar
- Removed the old exception that kept the "Start" label on phone; on phone all five buttons show icons only.
- On computer and tablet the label is under the icon. "Start" stays in the centre of the window.

### Settings: grid
- Each row: label in the left 2/3, control in the right 1/3 (on narrow screens 1/2). Buttons, menus and −/value/+ fill the control column; colour squares and switches sit at its right edge.
- Groups of buttons (Monitor, Remote, interface colours): 3 in a row; on narrow screens 2 + 1 with the third centred.
- Presets: label above, the first preset at the left edge, the last at the right edge, equal gaps; on the narrowest screens 3 + 3.
- Text and Background colours are two separate rows.
- Mirror (Horizontal/Vertical) is a row like the others.
- Connection: QR code (or scanner), label of the field, address, buttons — the same order for Monitor and Remote.
- Removed 55 old style rules that laid out single elements in Settings differently from their category.
- Reading marker rows have the same spacing as all other rows.

### Colour picker
- Added Cancel to all colour pickers (OK left, Cancel right). Where the colour is applied live (Settings), Cancel restores the colour from before opening.

### Dialogs
- "Delete" (and "Replace") is a normal button; the red styling code was removed.

### QR code size
- If there is not enough room, the QR code (and the scanner field) is 120 — the smallest readable size — and the section scrolls; before, it jumped to a larger 150.
- The size is rounded to steps of 8, so it no longer changes by 1–2 points on every opening.

### Clean-up of unused code
- Removed 87 style values that were always overwritten later for the same element, 12 rules that became empty, and styles for things that no longer exist.
- Removed 18 translations that were not used anywhere.
- Removed a note in Settings that was never shown, and the code that controlled it.
- Checked by comparing 28 style properties of every element (over 1800) in 8 states on computer, tablet and phone, and all texts in both languages: no differences apart from the removed note.

## 1.3.0 — 2026-11-21 23:40 (Europe/Sofia)

Base: index.html from the end of the previous chat (built on top of 1.2.0).

### Text storage
- Fixed loss of a large text: after a restart the editor could load an old copy from the small storage and, on the next keystroke, overwrite the large text with it. Reproduced with a ~6 million character text before the fix; after the fix the text survives a restart and editing.
- Texts are stored only in the large storage (IndexedDB). The small storage (localStorage) is kept only for settings.
- The editor no longer keeps its own copy of the text. On start it loads the open text from the large storage; typing is blocked for the fraction of a second until the storage is open.
- Texts from older versions (the list and the editor copy in the small storage) are moved once into the large storage and then removed from the small storage. An old editor copy that differs from the texts in the list is added as a separate text; it never overwrites an existing text.
- If the large storage does not work, the program shows "Texts cannot be saved on this device." instead of silently saving elsewhere.
- The second (reading) window reads the text only from the large storage.

### Language
- English is the base (source) language of the program; Bulgarian is a translation. On first start the language still follows the system (Bulgarian system → Bulgarian, otherwise English).
- The Bulgarian interface is unchanged word for word (checked by comparing all texts before and after).
- Translated to English some tooltips that had stayed in Bulgarian in English mode: text size in the formatting toolbar, "ALL CAPS", the names of the color buttons in Settings, "Go to the editor", "This device cannot be a Monitor.", the editor's screen-reader label.
- Color buttons in Settings and the picture toolbar tooltips now change language when the language is switched while the program runs.
- Disconnect button (Monitor and Remote): label "Disconnect" / "Прекъсни", tooltip "Disconnect" / "Прекъсни връзката".
- Save status while editing a text on the other device: "Saving…" / "Записвам…", "Saved" / "Записано" (editor save status stays "Saving…" / "Запазва се…", "Saved" / "Запазено").
