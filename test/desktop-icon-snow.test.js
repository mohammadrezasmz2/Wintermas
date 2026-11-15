import test from 'node:test';
import assert from 'node:assert/strict';
import { iconContactY, iconSnowLanding, iconObscuredByWindow,
  preferIconHit, placeIconSnow, syncIconSnow, snowCapSegments,
  iconUpperContour, iconRectChanged, fixedIconSurface,
  createIconDragMonitor, ICON_SNOW_MAX_DEPTH }
  from '../ui/desktop-icon-snow.js';

const rect={ id:'desktop-icon-2', left:40, top:50, right:88, bottom:98,
  contour: Array.from({length:24},(_,i)=>Math.round(90+250*(Math.abs(i-11.5)/11.5)**2)) };
const icon = { ...rect };
test('snow follows the actual icon alpha top edge rather than the label below',()=>{
  const center=iconContactY(rect,65),edge=iconContactY(rect,41);
  assert.ok(center>=50&&center<60);
  assert.equal(edge,null,'deep diagonal edges must not attract white patches inside a logo');
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
  const branded={...icon,contour,trusted:true};
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

test('idle UI Automation jitter does not make the snow bank creep upward',()=>{
  const banks=new Map(), hit=iconSnowLanding([icon],[],65,38,65,96);
  placeIconSnow(banks,hit);
  const pile=banks.get(icon.id), originalRect=pile.rect;
  const before=pile.surface.slice(), mass=pile.profile.reduce((n,d)=>n+d,0);
  let released=0;
  for(let n=0;n<70;n++) {
    const jitter=(n%7-3)*.62;
    const shifted={...icon,top:icon.top+jitter,bottom:icon.bottom+jitter,
      left:icon.left+jitter,right:icon.right+jitter,
      contour:icon.contour.map((v,i)=>v+((n+i)%3-1)*3)};
    assert.equal(iconRectChanged(originalRect,shifted),false);
    assert.equal(syncIconSnow(banks,[shifted],()=>released++),false);
    placeIconSnow(banks,{icon:shifted,x:65+jitter,y:56+jitter},0.1);
    assert.strictEqual(banks.get(icon.id).rect,originalRect,
      'the accumulated snow retains its INITIAL anchor');
    assert.deepEqual(banks.get(icon.id).surface,before,
      'surface never changes from repeated UIA samples');
  }
  assert.equal(released,0);
  assert.ok(banks.get(icon.id).profile.reduce((n,d)=>n+d,0)>mass);
  assert.deepEqual(fixedIconSurface(originalRect), before);
});

test('real icon drag releases the fixed bank exactly once',()=>{
  const banks=new Map(), hit=iconSnowLanding([icon],[],65,38,65,96);
  placeIconSnow(banks,hit);
  let released=0;
  const next={...icon,left:icon.left+7,right:icon.right+7};
  assert.equal(iconRectChanged(icon,next),true);
  assert.equal(syncIconSnow(banks,[next],()=>released++),true);
  assert.equal(syncIconSnow(banks,[next],()=>released++),false);
  assert.equal(released,1);
});

test('conservative unsupported icon fallback never puts snow deep into artwork', () => {
  const fallback={...icon,trusted:false,contour:Array(24).fill(55)};
  const y=iconContactY(fallback,65);
  assert.ok(y>=fallback.top && y<fallback.top+5,'fallback stays at top rim');
  const jagged={...fallback,contour:fallback.contour.map((v,i)=>i===8?140:v)};
  assert.equal(iconContactY(jagged, jagged.left+8.5*(jagged.right-jagged.left)/24),null);
});

test('recycle bin and custom 3D logos cannot produce sharp vertical snow fragments',()=>{
  const irregular=[150,125,95,86,80,75,71,68,65,63,60,58,58,60,63,65,68,71,75,80,86,95,125,150];
  const current={...icon,trusted:true,contour:irregular};
  const segments=snowCapSegments(current,new Float32Array(24).fill(5));
  assert.ok(segments.length<=1);
  for(const segment of segments) {
    assert.ok(segment.length>=5);
    for(let i=1;i<segment.length;i++)
      assert.ok(Math.abs(segment[i].y-segment[i-1].y)<3);
  }
});

test('new snow touches only valid top alpha strips, never hidden logo detail',()=>{
  const shape=Array(24).fill(60);
  shape[5]=520;shape[6]=720;
  const emblem={...icon,trusted:true,contour:shape};
  const banks=new Map();
  const center=iconSnowLanding([emblem],[],65,38,65,96);
  placeIconSnow(banks,center);
  assert.equal(banks.get(emblem.id).profile[5],0);
  assert.equal(banks.get(emblem.id).profile[6],0);
});
