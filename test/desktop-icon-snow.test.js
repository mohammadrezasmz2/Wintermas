import test from 'node:test';
import assert from 'node:assert/strict';
import { iconContactY, iconSnowLanding, iconObscuredByWindow,
  preferIconHit, placeIconSnow, syncIconSnow, snowCapSegments,
  iconUpperContour,
  createIconDragMonitor, ICON_SNOW_MAX_DEPTH }
  from '../ui/desktop-icon-snow.js';

const rect={ id:'desktop-icon-2', left:40, top:50, right:88, bottom:98,
  contour: Array.from({length:24},(_,i)=>Math.round(90+250*(Math.abs(i-11.5)/11.5)**2)) };
const icon = { ...rect };
test('snow follows the actual icon alpha top edge rather than the label below',()=>{
  const center=iconContactY(rect,65),edge=iconContactY(rect,41);
  assert.ok(center>=50&&center<60);
  assert.ok(edge>center,'a round icon has lower contact at its curved sides');
  assert.equal(iconContactY(rect,90),null);
  const transparent={...rect,contour:[...rect.contour]};
  transparent.contour[0]=-1;
  assert.equal(iconContactY(transparent,41),null);
});

test('falling snow settles on an exposed desktop icon and not on its text',()=>{
  const landed=iconSnowLanding([icon],[],65,38,65,96);
  assert.equal(landed.icon.id,'desktop-icon-2');
  assert.ok(landed.y<70,'snow hits the icon top, not the label below it');
});

test('icons hidden behind any open window do not accumulate visible snow',()=>{
  const app={id:'app',left:0,top:15,right:350,bottom:400,taskbar:false};
  assert.equal(iconSnowLanding([icon],[app],65,38,65,96),null);
  assert.ok(iconObscuredByWindow([app],65,65));
});
test('window snow outranks a desktop icon when its ledge is higher',()=>{
  const windowHit={rect:{id:'window',top:15},x:65};
  const iconHit=iconSnowLanding([icon],[],65,38,65,96);
  assert.equal(preferIconHit(windowHit,iconHit),windowHit);
  assert.equal(preferIconHit(null,iconHit),iconHit);
});

test('a pile sits on opaque strips only, at a modest capped depth',()=>{
  const banks=new Map(), contact=iconSnowLanding([icon],[],65,38,65,96);
  for(let i=0;i<30;i++)placeIconSnow(banks,contact);
  assert.equal(banks.size,1);
  assert.ok(Math.max(...banks.get(icon.id).profile)<=ICON_SNOW_MAX_DEPTH);
  const idx=Math.floor((65-40)/48*24);
  assert.ok(banks.get(icon.id).profile[idx]>3);
});

test('deleted or dragged desktop icon releases the old bank once',()=>{
  const banks=new Map(), hit=iconSnowLanding([icon],[],65,38,65,96);
  placeIconSnow(banks,hit);
  let released=0, weight=0;
  const drop=bank=>{released++;weight+=bank.profile.reduce((n,v)=>n+v,0)};
  assert.equal(syncIconSnow(banks,[{...icon}],drop),false);
  assert.equal(syncIconSnow(banks,[{...icon,left:icon.left+50,right:icon.right+50}],drop),true);
  assert.equal(released,1);
  assert.ok(weight>0);
  assert.equal(banks.size,0);
  assert.equal(syncIconSnow(banks,[],drop),false);
});

test('desktop icons without a valid alpha column cannot cause a phantom ridge',()=>{
 const empty={...icon,contour:Array(24).fill(-1)};
 assert.equal(iconSnowLanding([empty],[],65,38,65,96),null);
 const banks=new Map();
 placeIconSnow(banks,{icon:empty,x:65,y:55});
 assert.equal(banks.get(empty.id).profile.reduce((a,b)=>a+b,0),0);
});

test('snow forms smooth rounded continuous caps, not thin vertical comb teeth',()=>{
  const bank={...icon,contour:Array(24).fill(120)};
  const depth=new Float32Array(24).fill(6);
  const caps=snowCapSegments(bank,depth);
  assert.equal(caps.length,1,'a uniform folder rim produces one connected ridge');
  assert.equal(caps[0].length,24);
  const differences=caps[0].slice(1).map((p,i)=>Math.abs(p.depth-caps[0][i].depth));
  assert.ok(Math.max(...differences)<3,'shoulders taper without sawtooth spikes');
  assert.ok(caps[0][0].depth<caps[0][5].depth,'left shoulder is rounded');
  assert.ok(caps[0][23].depth<caps[0][12].depth,'right shoulder is rounded');
});
test('sharp icon alpha steps and transparent gaps produce separate caps, not tall walls',()=>{
  const stepped={...icon,contour:Array.from({length:24},(_,i)=>
    i>=10&&i<13?-1:i<10?100:680)};
  const caps=snowCapSegments(stepped,new Float32Array(24).fill(6));
  assert.equal(caps.length,1,'only the upper crest collects; the deep lower region stays clear');
  assert.ok(caps.every(c=>c.every((p,i)=>!i||Math.abs(p.y-c[i-1].y)<5)));
});
test('a small cursor movement immediately shakes icon powder off without awaiting Explorer',()=>{
  const drag=createIconDragMonitor(), banks=new Map(), hit=iconSnowLanding([icon],[],65,38,65,96);
  placeIconSnow(banks,hit);
  const drop=id=>{banks.delete(id)};
  drag.update({x:65,y:68,pressed:true},[icon],[],100,drop);
  assert.equal(banks.size,1,'merely pressing the icon does not remove snow');
  drag.update({x:67,y:70,pressed:true},[icon],[],118,drop);
  assert.equal(banks.size,1);
  assert.equal(drag.update({x:77,y:72,pressed:true},[icon],[],135,drop),true);
  assert.equal(banks.size,0);
  assert.equal(drag.isBlocked(icon.id,200),true);
  drag.update({x:77,y:72,pressed:false},[icon],[],150,drop);
  assert.equal(drag.isBlocked(icon.id,1000),false);
});
test('clicking through a covering application cannot shake hidden desktop snow',()=>{
  const drag=createIconDragMonitor();
  const cover={left:0,top:0,right:300,bottom:400};
  const calls=[];
  drag.update({x:65,y:68,pressed:true},[icon],[cover],100,id=>calls.push(id));
  assert.equal(drag.update({x:77,y:72,pressed:true},[icon],[cover],130,id=>calls.push(id)),false);
  assert.deepEqual(calls,[]);
});

test('deep opaque details in a brand logo cannot become snow ledges',()=>{
  // A desktop icon can have upper decoration plus an internal white logo.
  // Only the highest silhouette is a physical landing surface.
  const contour=Array(24).fill(90);
  contour[8]=740;contour[9]=800;contour[10]=870;
  const branded={...icon,contour};
  assert.ok(iconUpperContour(branded)<=100);
  assert.equal(iconContactY(branded,icon.left+9.5*(icon.right-icon.left)/24),null);
  assert.equal(iconSnowLanding([branded],[],icon.left+9.5*(icon.right-icon.left)/24,38,
    icon.left+9.5*(icon.right-icon.left)/24,99),null);
  const caps=snowCapSegments(branded,new Float32Array(24).fill(5));
  assert.ok(caps.every(segment=>segment.every(p=>p.y<branded.top+14)));
});
test('snow contact is outside icon artwork with no deep interior tracing',()=>{
  const c=iconContactY(icon,65);
  const raw=icon.top+(icon.bottom-icon.top)*icon.contour[Math.floor((65-icon.left)/(icon.right-icon.left)*24)]/1000;
  assert.ok(c<raw,'snow touches the top edge from outside the image');
});
