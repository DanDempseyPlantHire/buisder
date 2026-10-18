function arr(value){
  if(Array.isArray(value)) return value.map(v=>String(v).trim().toLowerCase()).filter(Boolean);
  try{if(String(value||'').trim().startsWith('[')) return JSON.parse(value).map(v=>String(v).trim().toLowerCase()).filter(Boolean);}catch{}
  return String(value||'').split(',').map(v=>v.trim().toLowerCase()).filter(Boolean);
}
function rad(x){return x*Math.PI/180;}
function distanceKm(aLat,aLng,bLat,bLng){
  if([aLat,aLng,bLat,bLng].some(v=>v===null||v===undefined||v==='')) return null;
  const R=6371,dLat=rad(Number(bLat)-Number(aLat)),dLng=rad(Number(bLng)-Number(aLng));
  const q=Math.sin(dLat/2)**2+Math.cos(rad(Number(aLat)))*Math.cos(rad(Number(bLat)))*Math.sin(dLng/2)**2;
  return R*2*Math.atan2(Math.sqrt(q),Math.sqrt(1-q));
}
function ageBandMinimum(value){
  const m=String(value||'').match(/(\d+)/); return m?Number(m[1]):null;
}
function overlaps(a,b){return a.some(x=>b.some(y=>x===y||x.includes(y)||y.includes(x)));}
export function scoreJobForProfile(job,profile={}){
  const candidateAge=ageBandMinimum(profile.age_band), minAge=Number(job.min_age||16);
  if(candidateAge!==null && Number.isFinite(minAge) && candidateAge<minAge){
    return {score:0,reasons:[`Requires age ${minAge}+`],distanceKm:null,eligible:false,version:'v24-rules-1'};
  }

  let score=0,weight=0; const reasons=[];
  weight+=20;
  const need=arr(job.schedule_tags), have=arr(profile.availability);
  if(!need.length){score+=14;reasons.push('Flexible availability');}
  else if(overlaps(need,have)){score+=20;reasons.push('Availability match');}
  else if(!have.length){score+=9;reasons.push('Availability not set');}

  weight+=25;
  const d=distanceKm(profile.latitude,profile.longitude,job.latitude,job.longitude), max=Number(profile.max_distance_km||25);
  if(d!==null){
    if(d<=Math.max(5,max*.25)){score+=25;reasons.push(`${d.toFixed(1)} km away`);}
    else if(d<=max){score+=17;reasons.push('Within travel preference');}
  }else{
    const pl=String(profile.location||'').toLowerCase(),jl=String(job.location||'').toLowerCase();
    if(pl&&jl&&(pl.includes(jl)||jl.includes(pl))){score+=19;reasons.push('Location match');} else score+=10;
  }

  weight+=20;
  const minPay=Number(profile.min_pay||0), pay=Number(job.pay_min||0);
  if(!minPay){score+=14;} else if(pay&&pay>=minPay){score+=20;reasons.push('Meets pay preference');} else if(!pay){score+=9;}

  weight+=15;
  const pref=String(profile.preferred_employment_type||'Any').toLowerCase();
  const type=String(job.employment_type||'').toLowerCase();
  if(pref==='any'){score+=10;} else if(type===pref){score+=15;reasons.push('Preferred work type');}

  weight+=10;
  const interests=arr(profile.interests), tags=arr(job.tags);
  if(!interests.length){score+=6;} else if(overlaps(interests,tags)){score+=10;reasons.push('Interest match');}

  weight+=10;
  const exp=String(job.experience||'None').toLowerCase();
  if(exp==='none'){score+=10;reasons.push('No experience required');} else if(exp==='helpful'){score+=7;} else score+=3;

  return {score:Math.max(0,Math.min(100,Math.round(score/weight*100))),reasons:reasons.slice(0,4),distanceKm:d,eligible:true,version:'v24-rules-1'};
}
