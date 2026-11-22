/* ---------- QR код (байтов режим, корекция L, версии 1–6) ---------- */
const QR=(()=>{
  const EC=[null,[7,1],[10,1],[15,1],[20,1],[26,1],[18,2]];      // [кодови думи за корекция на блок, брой блокове]
  const TOTAL=[0,26,44,70,100,134,172];
  const ALIGN=[null,null,18,22,26,30,34];
  const EXP=new Array(512),LOG=new Array(256);
  (()=>{let x=1;for(let i=0;i<255;i++){EXP[i]=x;LOG[x]=i;x<<=1;if(x&256)x^=0x11D}for(let i=255;i<512;i++)EXP[i]=EXP[i-255]})();
  const mul=(a,b)=>a&&b?EXP[LOG[a]+LOG[b]]:0;
  function rsGen(d){let g=[1];for(let i=0;i<d;i++){const n=new Array(g.length+1).fill(0);for(let j=0;j<g.length;j++){n[j]^=g[j];n[j+1]^=mul(g[j],EXP[i])}g=n}return g}
  function rsRem(data,d){const g=rsGen(d),r=new Array(d).fill(0);for(const b of data){const f=b^r.shift();r.push(0);for(let i=0;i<d;i++)r[i]^=mul(g[i+1],f)}return r}
  function build(text){
    const bytes=Array.from(new TextEncoder().encode(text));
    let ver=0;
    for(let v=1;v<=6;v++){const cap=TOTAL[v]-EC[v][0]*EC[v][1];if(bytes.length+2<=cap){ver=v;break}}
    if(!ver)return null;
    const dataCw=TOTAL[ver]-EC[ver][0]*EC[ver][1];
    let bits=[];const put=(v,n)=>{for(let i=n-1;i>=0;i--)bits.push((v>>>i)&1)};
    put(4,4);put(bytes.length,8);bytes.forEach(b=>put(b,8));
    put(0,Math.min(4,dataCw*8-bits.length));
    while(bits.length%8)bits.push(0);
    const data=[];for(let i=0;i<bits.length;i+=8){let v=0;for(let j=0;j<8;j++)v=(v<<1)|bits[i+j];data.push(v)}
    for(let pad=0xEC;data.length<dataCw;pad^=0xEC^0x11)data.push(pad);
    const [ecLen,nb]=EC[ver],nShort=nb-TOTAL[ver]%nb,shortLen=Math.floor(TOTAL[ver]/nb);
    const blocks=[];let k=0;
    for(let i=0;i<nb;i++){
      const len=shortLen-ecLen+(i<nShort?0:1);
      const d=data.slice(k,k+len);k+=len;
      blocks.push({d,e:rsRem(d,ecLen)});
    }
    const all=[];
    for(let i=0;i<blocks[blocks.length-1].d.length;i++)blocks.forEach(b=>{if(i<b.d.length)all.push(b.d[i])});
    for(let i=0;i<ecLen;i++)blocks.forEach(b=>all.push(b.e[i]));
    const size=ver*4+17;
    const M=Array.from({length:size},()=>new Array(size).fill(false)),F=Array.from({length:size},()=>new Array(size).fill(false));
    const setF=(x,y,v)=>{if(x>=0&&y>=0&&x<size&&y<size){M[y][x]=v;F[y][x]=true}};
    for(let i=0;i<size;i++){setF(6,i,i%2===0);setF(i,6,i%2===0)}
    for(const [cx,cy] of [[3,3],[size-4,3],[3,size-4]])
      for(let dy=-4;dy<=4;dy++)for(let dx=-4;dx<=4;dx++){const d=Math.max(Math.abs(dx),Math.abs(dy));setF(cx+dx,cy+dy,d!==2&&d!==4)}
    if(ver>=2){const c=ALIGN[ver];
      for(const [cx,cy] of [[c,c]])
        for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++)setF(cx+dx,cy+dy,Math.max(Math.abs(dx),Math.abs(dy))!==1);
    }
    const fmt=mask=>{
      const d=(1<<3)|mask;let r=d;for(let i=0;i<10;i++)r=(r<<1)^((r>>>9)*0x537);
      const b=((d<<10)|r)^0x5412,g=i=>((b>>>i)&1)===1;
      for(let i=0;i<=5;i++)setF(8,i,g(i));setF(8,7,g(6));setF(8,8,g(7));setF(7,8,g(8));
      for(let i=9;i<15;i++)setF(14-i,8,g(i));
      for(let i=0;i<8;i++)setF(size-1-i,8,g(i));
      for(let i=8;i<15;i++)setF(8,size-15+i,g(i));
      setF(8,size-8,true);
    };
    fmt(0);
    // запис на данните (зигзаг)
    const bitsAll=[];all.forEach(b=>{for(let j=7;j>=0;j--)bitsAll.push((b>>>j)&1)});
    let n=0;
    for(let right=size-1;right>=1;right-=2){
      if(right===6)right=5;
      for(let v=0;v<size;v++)for(let j=0;j<2;j++){
        const x=right-j,up=((right+1)&2)===0,y=up?size-1-v:v;
        if(!F[y][x]&&n<bitsAll.length){M[y][x]=bitsAll[n]===1;n++}
      }
    }
    const MASK=[(x,y)=>(x+y)%2===0,(x,y)=>y%2===0,(x,y)=>x%3===0,(x,y)=>(x+y)%3===0,(x,y)=>(Math.floor(x/3)+Math.floor(y/2))%2===0,(x,y)=>x*y%2+x*y%3===0,(x,y)=>(x*y%2+x*y%3)%2===0,(x,y)=>((x+y)%2+x*y%3)%2===0];
    function penalty(g){
      let p=0;
      for(let t=0;t<2;t++){
        for(let a=0;a<size;a++){
          let run=1;
          for(let b=1;b<size;b++){
            const c=t?g[b][a]:g[a][b],q=t?g[b-1][a]:g[a][b-1];
            if(c===q){run++;if(run===5)p+=3;else if(run>5)p++}else run=1;
          }
        }
      }
      for(let y=0;y<size-1;y++)for(let x=0;x<size-1;x++){const c=g[y][x];if(c===g[y][x+1]&&c===g[y+1][x]&&c===g[y+1][x+1])p+=3}
      let dark=0;g.forEach(r=>r.forEach(v=>{if(v)dark++}));
      p+=Math.floor(Math.abs(dark*20-size*size*10)/(size*size))*10;
      return p;
    }
    let best=null,bestP=1e9,bestM=0;
    for(let m=0;m<8;m++){
      const g=M.map((r,y)=>r.map((v,x)=>F[y][x]?v:(v!==MASK[m](x,y))));
      const p=penalty(g);if(p<bestP){bestP=p;best=g;bestM=m}
    }
    // формат с избраната маска върху готовата матрица
    for(let y=0;y<size;y++)for(let x=0;x<size;x++){M[y][x]=best[y][x]}
    fmt(bestM);
    return M;
  }
  function draw(canvas,text,px){
    const m=build(text);if(!m)return false;
    const q=4,n=m.length,s=px||6;canvas.width=canvas.height=(n+q*2)*s;
    const c=canvas.getContext('2d');c.fillStyle='#fff';c.fillRect(0,0,canvas.width,canvas.height);c.fillStyle='#000';
    for(let y=0;y<n;y++)for(let x=0;x<n;x++)if(m[y][x])c.fillRect((x+q)*s,(y+q)*s,s,s);
    return true;
  }
  return {build,draw};
})();

