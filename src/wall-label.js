import * as T from "three";
import {workLine} from "./installation.js";
import {typeLabels} from "./formats.js";

function lines(ctx, text, width, limit) {
  const words=String(text||"").split(/\s+/), result=[];
  let line="";
  for (const word of words) {
    const next=line?line+" "+word:word;
    if(line && ctx.measureText(next).width>width){ result.push(line); line=word; }
    else line=next;
  }
  if(line) result.push(line);
  if(result.length>limit) result[limit-1]+="…";
  return result.slice(0,limit);
}
export function labelTexture(work, style, bright) {
  const c=document.createElement("canvas"); c.width=896;c.height=216;
  const g=c.getContext("2d"), paper=style==="paper";
  if(paper){g.fillStyle="#e9e0c9";g.fillRect(0,0,c.width,c.height);}
  g.fillStyle=paper||bright?"#262821":"#f8f0dc";
  const pad=paper?36:6;
  g.font='italic 49px "Instrument Serif", Georgia, serif';
  const title=lines(g,work.title,820,2);
  title.forEach((line,i)=>g.fillText(line,pad,65+i*53,820));
  g.font='27px "Space Grotesk Variable", sans-serif';
  g.fillText(workLine(work),pad,86+title.length*41,820);
  const map=new T.CanvasTexture(c);map.colorSpace=T.SRGBColorSpace;
  return map;
}
export function wallLabel(work, style, bright, width=1.2) {
  if(style==="hidden") return null;
  const paper=style==="paper", map=labelTexture(work,style,bright);
  return new T.Mesh(new T.PlaneGeometry(width,width*map.image.height/map.image.width),
    new T.MeshBasicMaterial({map,transparent:!paper,depthWrite:paper,toneMapped:false}));
}
export function mediaCover(w) {
  const c=document.createElement("canvas");c.width=768;c.height=488;
  const g=c.getContext("2d"), audio=w.type==="audio", film=w.type==="video";
  g.fillStyle=audio?"#875039":film?"#182126":"#e6deca";g.fillRect(0,0,768,488);
  if(audio){
    const fade=g.createRadialGradient(576,244,24,576,244,221);
    fade.addColorStop(0,"#33342f");fade.addColorStop(.6,"#0b0f12");fade.addColorStop(1,"#2d302d");
    g.fillStyle=fade;g.beginPath();g.arc(623,213,226,0,Math.PI*2);g.fill();
    for(let r=72;r<218;r+=5){g.strokeStyle=r%2?"#5a595033":"#b7b29d32";g.beginPath();g.arc(623,213,r,0,Math.PI*2);g.stroke();}
    g.fillStyle="#ccb58f";g.beginPath();g.arc(623,213,56,0,Math.PI*2);g.fill();
    g.fillStyle="#292c29";g.fillRect(618,208,10,10);
  } else if(film) {
    for(let i=0;i<22;i++){g.fillStyle="#a29371";g.fillRect(8+36*i,15,18,9);g.fillRect(8+36*i,464,18,9);}
    g.strokeStyle="#d5bb92";g.lineWidth=3;g.beginPath();g.arc(604,198,50,0,Math.PI*2);g.stroke();
    g.fillStyle="#d5bb92";g.beginPath();g.moveTo(594,178);g.lineTo(623,198);g.lineTo(594,218);g.fill();
  } else {
    g.strokeStyle="#99917b";g.beginPath();g.moveTo(42,95);g.lineTo(726,95);g.stroke();
    g.fillStyle="#565a4b";g.font="60px Georgia,serif";g.fillText(w.type==="source"?"{ }":"¶",600,195);
  }
  g.fillStyle=audio||film?"#fff1d8":"#292c28";g.font="21px sans-serif";
  g.fillText(w.medium||typeLabels[w.type]||"",42,72,450);
  g.font='italic 54px "Instrument Serif", Georgia, serif';
  lines(g,w.title,audio?350:510,3).forEach((line,i)=>g.fillText(line,42,282+i*58,audio?350:510));
  return new T.CanvasTexture(c);
}
