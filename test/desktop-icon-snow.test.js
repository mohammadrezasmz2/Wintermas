import test from 'node:test';
import assert from 'node:assert/strict';
import { iconContactY, iconSnowLanding, iconObscuredByWindow,
  preferIconHit, placeIconSnow, syncIconSnow, ICON_SNOW_MAX_DEPTH }
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
