import { err, requireUser } from '../../../_lib/db.js';
function icsEscape(s){return String(s||'').replace(/\\/g,'\\\\').replace(/\n/g,'\\n').replace(/,/g,'\\,').replace(/;/g,'\\;');}
function icsTime(v){const d=new Date(v); if(Number.isNaN(d.getTime()))return null; return d.toISOString().replace(/[-:]/g,'').replace(/\.\d{3}Z$/,'Z');}
export async function onRequestGet(context){
  const {user,error}=await requireUser(context); if(error)return error;
  const row=await context.env.DB.prepare(
    `SELECT a.id,a.jobseeker_id AS jobseekerId,j.employer_id AS employerId,j.title,j.company,ii.interview_at AS interviewAt,ii.location,ii.message
     FROM applications a JOIN jobs j ON j.id=a.job_id JOIN interview_invites ii ON ii.application_id=a.id WHERE a.id=?`
  ).bind(context.params.applicationId).first();
  if(!row||![row.jobseekerId,row.employerId].includes(user.id))return err('Interview not found',404);
  const start=icsTime(row.interviewAt); if(!start)return err('Interview date is invalid');
  const end=icsTime(new Date(new Date(row.interviewAt).getTime()+60*60*1000).toISOString());
  const text=`BEGIN:VCALENDAR\r\nVERSION:2.0\r\nPRODID:-//DEASJobs//Interview//EN\r\nCALSCALE:GREGORIAN\r\nBEGIN:VEVENT\r\nUID:${row.id}@deasjobs\r\nDTSTAMP:${icsTime(new Date().toISOString())}\r\nDTSTART:${start}\r\nDTEND:${end}\r\nSUMMARY:${icsEscape(`Interview - ${row.title}`)}\r\nDESCRIPTION:${icsEscape(row.message||`Interview with ${row.company||'employer'}`)}\r\nLOCATION:${icsEscape(row.location||'')}\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n`;
  return new Response(text,{headers:{'Content-Type':'text/calendar; charset=utf-8','Content-Disposition':`attachment; filename="deasjobs-interview-${row.id}.ics"`,'Cache-Control':'no-store'}});
}
