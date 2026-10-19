// DEASJobs v25.2 compact Functions: original endpoint handlers, grouped by route.
// Individual handlers and their authentication/validation logic are preserved.
// Do not restore the old route files when deploying this compact module.
import * as _import0 from "../../_lib/db.js";
import * as _import1 from "../../_lib/email-notifications.js";
import * as _import2 from "../../_lib/analytics.js";
import * as _import3 from "../../_lib/risk.js";

// Original: functions/api/applications/[id]/invite.js
const _handler0 = (() => {
  const { json, err, newId, requireUser, createNotification } = _import0;
  const { sendRecruitmentEmail } = _import1;
  async function onRequestPost(context) {
    const { request, env, params } = context;
    const { user, error } = await requireUser(context, "employer");
    if (error) return error;

    const body = await request.json().catch(() => null);
    const interviewAt = body && typeof body.interviewAt === "string" ? body.interviewAt.trim() : "";
    const interviewLocation = body && typeof body.interviewLocation === "string" ? body.interviewLocation.trim() : "";
    const interviewMessage = body && typeof body.interviewMessage === "string" ? body.interviewMessage.trim() : "";

    if (!interviewAt) return err("Interview date and time are required");
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(interviewAt)) {
      return err("Interview date and time are invalid");
    }

    const app = await env.DB.prepare(
      `SELECT a.id, a.status, a.shortlisted_at, a.jobseeker_id,
              j.employer_id, j.id AS job_id, j.title AS job_title, j.company
       FROM applications a
       JOIN jobs j ON j.id = a.job_id
       WHERE a.id = ?`
    ).bind(params.id).first();

    if (!app) return err("Application not found", 404);
    if (app.employer_id !== user.id) return err("Not your job posting", 403);

    if (app.status === "applied") {
      return err("Shortlist the candidate before inviting them to interview");
    }

    const interviewStages = new Set([
      "shortlisted",
      "interview_invited",
      "interview_accepted",
      "interview_declined"
    ]);

    if (!interviewStages.has(app.status)) {
      return err("This application can no longer be moved into the interview stage");
    }

    const existing = await env.DB.prepare(
      "SELECT id FROM interview_invites WHERE application_id = ?"
    ).bind(params.id).first();

    if (existing) {
      await env.DB.prepare(
        `UPDATE interview_invites
         SET interview_at = ?, location = ?, message = ?, status = 'pending',
             seen_at = NULL, updated_at = datetime('now')
         WHERE application_id = ?`
      ).bind(interviewAt, interviewLocation || null, interviewMessage || null, params.id).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO interview_invites
         (id, application_id, interview_at, location, message, status)
         VALUES (?, ?, ?, ?, ?, 'pending')`
      ).bind(newId(), params.id, interviewAt, interviewLocation || null, interviewMessage || null).run();
    }

    await env.DB.prepare(
      `UPDATE applications
       SET status='interview_invited',
           interview_invited_at=datetime('now'),
           interview_accepted_at=NULL,
           interview_declined_at=NULL,
           interview_completed_at=NULL,
           updated_at=datetime('now')
       WHERE id=?`
    ).bind(params.id).run();

    if (app.status !== "interview_invited") {
      await env.DB.prepare(
        `INSERT INTO application_status_history
         (id, application_id, status, actor_user_id, note)
         VALUES (?, ?, 'interview_invited', ?, ?)`
      ).bind(
        newId(),
        params.id,
        user.id,
        existing ? "Interview rescheduled and invitation renewed" : "Interview invitation sent"
      ).run();
    } else if (existing) {
      await env.DB.prepare(
        `INSERT INTO application_status_history
         (id, application_id, status, actor_user_id, note)
         VALUES (?, ?, 'interview_invited', ?, 'Interview rescheduled')`
      ).bind(newId(), params.id, user.id).run();
    }

    await createNotification(env, {
      userId: app.jobseeker_id,
      type: existing ? "interview_updated" : "interview_invitation",
      title: existing ? "Interview updated" : "Interview invitation",
      body: `${app.company || "An employer"} ${existing ? "updated" : "invited you to"} an interview for ${app.job_title} on ${interviewAt.replace("T", " ")}${interviewLocation ? " · " + interviewLocation : ""}.`,
      applicationId: params.id,
      jobId: app.job_id,
      eventKey: `interview:${params.id}:${interviewAt}:${interviewLocation || ""}`
    });

    await sendRecruitmentEmail(env, request, {
      userId:app.jobseeker_id, category:"interview",
      eventType:existing ? "interview_updated" : "interview_invitation",
      eventKey:`email:interview:${params.id}:${interviewAt}:${interviewLocation || ""}`,
      subject:`${existing ? "Interview updated" : "Interview invitation"}: ${app.job_title}`,
      heading:existing ? "Your interview was updated" : "Interview invitation",
      body:`${app.company || "An employer"} ${existing ? "updated your interview" : "invited you to an interview"} for ${app.job_title}.`,
      applicationId:params.id, jobId:app.job_id,
      detailLines:[`When: ${interviewAt.replace("T", " ")}`, interviewLocation ? `Where: ${interviewLocation}` : null, interviewMessage ? `Message: ${interviewMessage}` : null]
    });

    return json({ ok: true });
  }
  return { onRequestPost };
})();

// Original: functions/api/applications/[id]/offer.js
const _handler1 = (() => {
  const { json, err, newId, requireUser, createNotification } = _import0;
  const { sendRecruitmentEmail } = _import1;
  async function addHistory(env, applicationId, status, actorUserId, note = null) {
    await env.DB.prepare(
      `INSERT INTO application_status_history
       (id, application_id, status, actor_user_id, note)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(newId(), applicationId, status, actorUserId, note).run();
  }

  async function onRequestPost(context) {
    const { request, env, params } = context;
    const { user, error } = await requireUser(context, "employer");
    if (error) return error;

    const body = await request.json().catch(() => null);
    if (!body) return err("Invalid request body");

    const roleTitle = String(body.roleTitle || "").trim();
    const pay = String(body.pay || "").trim();
    const startDate = String(body.startDate || "").trim();
    const message = String(body.message || "").trim();

    if (!roleTitle) return err("Role title is required");
    if (!pay) return err("Pay is required");
    if (!startDate) return err("Start date is required");

    const app = await env.DB.prepare(
      `SELECT a.id, a.status, a.jobseeker_id,
              j.id AS job_id, j.employer_id, j.title AS job_title, j.company
       FROM applications a
       JOIN jobs j ON j.id=a.job_id
       WHERE a.id=?`
    ).bind(params.id).first();

    if (!app) return err("Application not found", 404);
    if (app.employer_id !== user.id) return err("Not your job posting", 403);

    if (!["interview_completed", "offer_made", "offer_declined"].includes(app.status)) {
      return err("Complete the interview before making an offer");
    }

    const existing = await env.DB.prepare(
      "SELECT id, status FROM job_offers WHERE application_id=?"
    ).bind(params.id).first();

    if (existing?.status === "accepted") {
      return err("This offer has already been accepted");
    }

    if (existing) {
      await env.DB.prepare(
        `UPDATE job_offers
         SET role_title=?, pay=?, start_date=?, message=?,
             status='pending', responded_at=NULL, updated_at=CURRENT_TIMESTAMP
         WHERE application_id=?`
      ).bind(roleTitle, pay, startDate, message, params.id).run();
    } else {
      await env.DB.prepare(
        `INSERT INTO job_offers
         (id, application_id, employer_id, jobseeker_id, role_title, pay, start_date, message)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
      ).bind(
        newId(), params.id, user.id, app.jobseeker_id,
        roleTitle, pay, startDate, message
      ).run();
    }

    await env.DB.prepare(
      `UPDATE applications
       SET status='offer_made', updated_at=datetime('now')
       WHERE id=?`
    ).bind(params.id).run();

    await addHistory(
      env,
      params.id,
      "offer_made",
      user.id,
      existing ? "Offer updated and sent to candidate" : "Offer sent to candidate"
    );

    await createNotification(env, {
      userId: app.jobseeker_id,
      type: existing ? "offer_updated" : "offer_made",
      title: existing ? "Job offer updated" : "You have a job offer",
      body: `${app.company || "An employer"} sent you an offer for ${roleTitle}: ${pay}, starting ${startDate}.`,
      applicationId: params.id,
      jobId: app.job_id
    });

    await sendRecruitmentEmail(env, request, {
      userId:app.jobseeker_id, category:"offer", eventType:existing ? "offer_updated" : "offer_made",
      eventKey:`email:offer:${params.id}:${roleTitle}:${pay}:${startDate}`,
      subject:`${existing ? "Updated job offer" : "Job offer"}: ${roleTitle}`,
      heading:existing ? "Your job offer was updated" : "You have a job offer",
      body:`${app.company || "An employer"} sent you an offer for ${roleTitle}.`,
      applicationId:params.id, jobId:app.job_id,
      detailLines:[`Pay: ${pay}`, `Start date: ${startDate}`, message ? `Message: ${message}` : null]
    });

    return json({ ok: true, status: "offer_made" });
  }

  async function onRequestPatch(context) {
    const { request, env, params } = context;
    const { user, error } = await requireUser(context, "jobseeker");
    if (error) return error;

    const body = await request.json().catch(() => null);
    const response = String(body?.response || "").toLowerCase();

    if (!["accepted", "declined"].includes(response)) {
      return err("Response must be accepted or declined");
    }

    const offer = await env.DB.prepare(
      `SELECT o.id, o.status, o.jobseeker_id, o.role_title,
              a.id AS application_id, a.status AS application_status,
              j.id AS job_id, j.employer_id, j.title AS job_title
       FROM job_offers o
       JOIN applications a ON a.id=o.application_id
       JOIN jobs j ON j.id=a.job_id
       WHERE o.application_id=?`
    ).bind(params.id).first();

    if (!offer) return err("Offer not found", 404);
    if (offer.jobseeker_id !== user.id) return err("This offer is not yours", 403);
    if (offer.status !== "pending" || offer.application_status !== "offer_made") {
      return err("This offer has already been answered");
    }

    await env.DB.prepare(
      `UPDATE job_offers
       SET status=?, responded_at=CURRENT_TIMESTAMP, updated_at=CURRENT_TIMESTAMP
       WHERE application_id=?`
    ).bind(response, params.id).run();

    const applicationStatus = response === "accepted" ? "offer_accepted" : "offer_declined";

    await env.DB.prepare(
      `UPDATE applications
       SET status=?, updated_at=datetime('now')
       WHERE id=?`
    ).bind(applicationStatus, params.id).run();

    await addHistory(
      env,
      params.id,
      applicationStatus,
      user.id,
      response === "accepted" ? "Offer accepted by candidate" : "Offer declined by candidate"
    );

    await createNotification(env, {
      userId: offer.employer_id,
      type: "offer_response",
      title: response === "accepted" ? "Offer accepted" : "Offer declined",
      body: `${user.name || "The candidate"} ${response} the offer for ${offer.job_title}.`,
      applicationId: params.id,
      jobId: offer.job_id,
      eventKey: `offer-response:${params.id}:${applicationStatus}`
    });

    await sendRecruitmentEmail(env, request, {
      userId:offer.employer_id, category:"offer", eventType:"offer_response",
      eventKey:`email:offer-response:${params.id}:${applicationStatus}`,
      subject:`Offer ${response}: ${offer.job_title}`,
      heading:response === "accepted" ? "Offer accepted" : "Offer declined",
      body:`${user.name || "The candidate"} ${response} the offer for ${offer.job_title}.`,
      applicationId:params.id, jobId:offer.job_id
    });

    return json({ ok: true, status: applicationStatus });
  }
  return { onRequestPost, onRequestPatch };
})();

// Original: functions/api/applications/[id]/respond.js
const _handler2 = (() => {
  const { json, err, newId, requireUser, createNotification } = _import0;
  const { sendRecruitmentEmail } = _import1;
  async function onRequestPost(context) {
    const { request, env, params } = context;
    const { user, error } = await requireUser(context, "jobseeker");
    if (error) return error;

    const body = await request.json().catch(() => null);
    const response = body && body.response;
    if (!["accepted", "declined"].includes(response)) {
      return err("Response must be accepted or declined");
    }

    const app = await env.DB.prepare(
      `SELECT a.id, a.status, a.jobseeker_id, ii.id AS invite_id,
              j.employer_id, j.id AS job_id, j.title AS job_title
       FROM applications a
       JOIN jobs j ON j.id=a.job_id
       LEFT JOIN interview_invites ii ON ii.application_id = a.id
       WHERE a.id = ?`
    ).bind(params.id).first();

    if (!app) return err("Application not found", 404);
    if (app.jobseeker_id !== user.id) return err("Not your application", 403);
    if (!app.invite_id) return err("No interview invitation found", 404);
    if (app.status !== "interview_invited") {
      return err("This interview invitation is no longer actionable");
    }

    await env.DB.prepare(
      `UPDATE interview_invites
       SET status = ?, seen_at = COALESCE(seen_at, datetime('now')), updated_at = datetime('now')
       WHERE application_id = ?`
    ).bind(response, params.id).run();

    const newStatus = response === "accepted" ? "interview_accepted" : "interview_declined";

    if (response === "accepted") {
      await env.DB.prepare(
        `UPDATE applications
         SET status='interview_accepted',
             interview_accepted_at=datetime('now'),
             interview_declined_at=NULL,
             interview_completed_at=NULL,
             updated_at=datetime('now')
         WHERE id=?`
      ).bind(params.id).run();
    } else {
      await env.DB.prepare(
        `UPDATE applications
         SET status='interview_declined',
             interview_declined_at=datetime('now'),
             interview_accepted_at=NULL,
             interview_completed_at=NULL,
             updated_at=datetime('now')
         WHERE id=?`
      ).bind(params.id).run();
    }

    await env.DB.prepare(
      `INSERT INTO application_status_history
       (id, application_id, status, actor_user_id, note)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(
      newId(),
      params.id,
      newStatus,
      user.id,
      response === "accepted" ? "Interview accepted by candidate" : "Interview declined by candidate"
    ).run();

    await createNotification(env, {
      userId: app.employer_id,
      type: "interview_response",
      title: response === "accepted" ? "Interview accepted" : "Interview declined",
      body: `${user.name || "The candidate"} ${response} the interview for ${app.job_title}.`,
      applicationId: params.id,
      jobId: app.job_id,
      eventKey: `interview-response:${params.id}:${newStatus}`
    });

    await sendRecruitmentEmail(env, request, {
      userId:app.employer_id, category:"interview", eventType:"interview_response",
      eventKey:`email:interview-response:${params.id}:${newStatus}`,
      subject:`Interview ${response}: ${app.job_title}`,
      heading:response === "accepted" ? "Interview accepted" : "Interview declined",
      body:`${user.name || "The candidate"} ${response} the interview for ${app.job_title}.`,
      applicationId:params.id, jobId:app.job_id
    });

    return json({ ok: true, status: newStatus });
  }
  return { onRequestPost };
})();

// Original: functions/api/applications/[id]/seen.js
const _handler3 = (() => {
  const { json, err, requireUser } = _import0;
  async function onRequestPost(context) {
    const { env, params } = context;
    const { user, error } = await requireUser(context, "jobseeker");
    if (error) return error;

    const app = await env.DB.prepare(
      `SELECT a.id, a.jobseeker_id, ii.id AS invite_id
       FROM applications a
       LEFT JOIN interview_invites ii ON ii.application_id = a.id
       WHERE a.id = ?`
    ).bind(params.id).first();

    if (!app) return err("Application not found", 404);
    if (app.jobseeker_id !== user.id) return err("Not your application", 403);
    if (!app.invite_id) return err("No interview invitation found", 404);

    await env.DB.prepare(
      `UPDATE interview_invites
       SET seen_at = COALESCE(seen_at, datetime('now')), updated_at = datetime('now')
       WHERE application_id = ?`
    ).bind(params.id).run();

    return json({ ok: true });
  }
  return { onRequestPost };
})();

// Original: functions/api/applications/[id]/status.js
const _handler4 = (() => {
  const { json, err, newId, requireUser, createNotification } = _import0;
  const { sendRecruitmentEmail } = _import1;
  const ALLOWED = new Set([
    "shortlist",
    "remove_shortlist",
    "interview_completed",
    "mark_hired",
    "mark_unsuccessful"
  ]);

  async function addHistory(env, applicationId, status, actorUserId, note = null) {
    await env.DB.prepare(
      `INSERT INTO application_status_history
       (id, application_id, status, actor_user_id, note)
       VALUES (?, ?, ?, ?, ?)`
    ).bind(newId(), applicationId, status, actorUserId, note).run();
  }

  async function onRequestPost(context) {
    const { request, env, params } = context;
    const { user, error } = await requireUser(context, "employer");
    if (error) return error;

    const body = await request.json().catch(() => null);
    const action = String(body?.action || "");
    if (!ALLOWED.has(action)) return err("Unsupported application action");

    const app = await env.DB.prepare(
      `SELECT a.id, a.status, a.shortlisted_at, a.interview_completed_at,
              a.jobseeker_id,
              j.employer_id, j.id AS job_id, j.title AS job_title, j.company,
              ii.status AS interview_status,
              o.status AS offer_status
       FROM applications a
       JOIN jobs j ON j.id=a.job_id
       LEFT JOIN interview_invites ii ON ii.application_id=a.id
       LEFT JOIN job_offers o ON o.application_id=a.id
       WHERE a.id=?`
    ).bind(params.id).first();

    if (!app) return err("Application not found", 404);
    if (app.employer_id !== user.id) return err("Not your job posting", 403);

    const finalStatuses = new Set(["hired", "unsuccessful", "withdrawn"]);
    if (finalStatuses.has(app.status)) {
      return err("This application is already closed");
    }

    if (action === "shortlist") {
      if (!["applied", "shortlisted"].includes(app.status)) {
        return err("This application has already moved beyond shortlisting");
      }

      await env.DB.prepare(
        `UPDATE applications
         SET status='shortlisted',
             shortlisted_at=COALESCE(shortlisted_at, datetime('now')),
             updated_at=datetime('now')
         WHERE id=?`
      ).bind(params.id).run();

      if (app.status !== "shortlisted") {
        await addHistory(env, params.id, "shortlisted", user.id, "Candidate shortlisted by employer");
        await createNotification(env, {
          userId: app.jobseeker_id,
          type: "shortlisted",
          title: "You were shortlisted",
          body: `${app.company || "An employer"} shortlisted you for ${app.job_title}.`,
          applicationId: params.id,
          jobId: app.job_id,
          eventKey: `application:${params.id}:shortlisted`
        });
        await sendRecruitmentEmail(env, request, {
          userId:app.jobseeker_id, category:"application", eventType:"shortlisted",
          eventKey:`email:application:${params.id}:shortlisted`,
          subject:`You were shortlisted: ${app.job_title}`,
          heading:"You were shortlisted",
          body:`${app.company || "An employer"} shortlisted you for ${app.job_title}.`,
          applicationId:params.id, jobId:app.job_id
        });
      }

      return json({ ok: true, status: "shortlisted" });
    }

    if (action === "remove_shortlist") {
      if (app.status !== "shortlisted") {
        return err("Only a shortlisted application can be moved back to Applied");
      }

      await env.DB.prepare(
        `UPDATE applications
         SET status='applied',
             shortlisted_at=NULL,
             updated_at=datetime('now')
         WHERE id=?`
      ).bind(params.id).run();

      await addHistory(env, params.id, "applied", user.id, "Candidate removed from shortlist");
      await createNotification(env, {
        userId: app.jobseeker_id,
        type: "application_update",
        title: "Application updated",
        body: `Your application for ${app.job_title} has moved back to Applied.`,
        applicationId: params.id,
        jobId: app.job_id,
        eventKey: `application:${params.id}:back_to_applied`
      });
      await sendRecruitmentEmail(env, request, {
        userId:app.jobseeker_id, category:"application", eventType:"application_update",
        eventKey:`email:application:${params.id}:back_to_applied`,
        subject:`Application update: ${app.job_title}`,
        heading:"Your application was updated",
        body:`Your application for ${app.job_title} has moved back to Applied.`,
        applicationId:params.id, jobId:app.job_id
      });
      return json({ ok: true, status: "applied" });
    }

    if (action === "interview_completed") {
      if (app.status !== "interview_accepted" || app.interview_status !== "accepted") {
        return err("The candidate must accept the interview before it can be marked completed");
      }

      await env.DB.prepare(
        `UPDATE applications
         SET status='interview_completed',
             interview_completed_at=datetime('now'),
             updated_at=datetime('now')
         WHERE id=?`
      ).bind(params.id).run();

      await addHistory(env, params.id, "interview_completed", user.id, "Interview marked completed by employer");
      await createNotification(env, {
        userId: app.jobseeker_id,
        type: "interview_completed",
        title: "Interview completed",
        body: `${app.company || "The employer"} marked your ${app.job_title} interview as completed.`,
        applicationId: params.id,
        jobId: app.job_id,
        eventKey: `application:${params.id}:interview_completed`
      });
      await sendRecruitmentEmail(env, request, {
        userId:app.jobseeker_id, category:"interview", eventType:"interview_completed",
        eventKey:`email:application:${params.id}:interview_completed`,
        subject:`Interview completed: ${app.job_title}`,
        heading:"Interview completed",
        body:`${app.company || "The employer"} marked your ${app.job_title} interview as completed.`,
        applicationId:params.id, jobId:app.job_id
      });
      return json({ ok: true, status: "interview_completed" });
    }


    if (action === "mark_unsuccessful") {
      if (app.status === "offer_accepted") {
        return err("The candidate has accepted the offer. Resolve that directly before closing the application.");
      }

      const note = String(body?.note || "").trim();

      await env.DB.prepare(
        `UPDATE applications
         SET status='unsuccessful',
             updated_at=datetime('now')
         WHERE id=?`
      ).bind(params.id).run();

      // Close any still-pending candidate actions so the final state cannot be overridden.
      await env.DB.prepare(
        `UPDATE interview_invites
         SET status='declined',
             seen_at=COALESCE(seen_at, datetime('now')),
             updated_at=datetime('now')
         WHERE application_id=? AND status='pending'`
      ).bind(params.id).run();

      await env.DB.prepare(
        `UPDATE job_offers
         SET status='declined',
             responded_at=COALESCE(responded_at, CURRENT_TIMESTAMP),
             updated_at=CURRENT_TIMESTAMP
         WHERE application_id=? AND status='pending'`
      ).bind(params.id).run();

      await addHistory(
        env,
        params.id,
        "unsuccessful",
        user.id,
        note ? `Marked unsuccessful by employer: ${note}` : "Marked unsuccessful by employer"
      );

      await createNotification(env, {
        userId: app.jobseeker_id,
        type: "unsuccessful",
        title: "Application update",
        body: `${app.company || "The employer"} has closed your application for ${app.job_title}.`,
        applicationId: params.id,
        jobId: app.job_id,
        eventKey: `application:${params.id}:unsuccessful`
      });

      await sendRecruitmentEmail(env, request, {
        userId:app.jobseeker_id, category:"outcome", eventType:"unsuccessful",
        eventKey:`email:application:${params.id}:unsuccessful`,
        subject:`Application update: ${app.job_title}`,
        heading:"Application outcome",
        body:`${app.company || "The employer"} has closed your application for ${app.job_title}.`,
        applicationId:params.id, jobId:app.job_id
      });

      return json({ ok: true, status: "unsuccessful" });
    }

    if (action === "mark_hired") {
      if (app.status !== "offer_accepted" || app.offer_status !== "accepted") {
        return err("The candidate must accept the offer before they can be marked Hired");
      }

      await env.DB.prepare(
        `UPDATE applications
         SET status='hired',
             updated_at=datetime('now')
         WHERE id=?`
      ).bind(params.id).run();

      await addHistory(env, params.id, "hired", user.id, "Candidate marked hired by employer");
      await createNotification(env, {
        userId: app.jobseeker_id,
        type: "hired",
        title: "You’re hired",
        body: `${app.company || "The employer"} marked you as hired for ${app.job_title}.`,
        applicationId: params.id,
        jobId: app.job_id,
        eventKey: `application:${params.id}:hired`
      });
      await sendRecruitmentEmail(env, request, {
        userId:app.jobseeker_id, category:"outcome", eventType:"hired",
        eventKey:`email:application:${params.id}:hired`,
        subject:`You’re hired: ${app.job_title}`,
        heading:"You’re hired",
        body:`${app.company || "The employer"} marked you as hired for ${app.job_title}.`,
        applicationId:params.id, jobId:app.job_id
      });
      return json({ ok: true, status: "hired" });
    }

    return err("Unsupported application action");
  }
  return { onRequestPost };
})();

// Original: functions/api/applications/[id]/withdraw.js
const _handler5 = (() => {
  const { json, err, newId, requireUser, createNotification } = _import0;
  const { sendRecruitmentEmail } = _import1;
  async function onRequestPost(context) {
    const { request, env, params } = context;
    const { user, error } = await requireUser(context, "jobseeker");
    if (error) return error;

    const app = await env.DB.prepare(
      `SELECT a.id, a.status, a.jobseeker_id,
              j.id AS job_id, j.employer_id, j.title AS job_title
       FROM applications a
       JOIN jobs j ON j.id=a.job_id
       WHERE a.id=?`
    ).bind(params.id).first();

    if (!app) return err("Application not found", 404);
    if (app.jobseeker_id !== user.id) return err("Not your application", 403);

    if (["hired", "unsuccessful", "withdrawn"].includes(app.status)) {
      return err("This application is already closed");
    }

    await env.DB.prepare(
      `UPDATE applications
       SET status='withdrawn',
           updated_at=datetime('now')
       WHERE id=?`
    ).bind(params.id).run();

    // Prevent any outstanding invitation or offer from remaining actionable.
    await env.DB.prepare(
      `UPDATE interview_invites
       SET status='declined',
           seen_at=COALESCE(seen_at, datetime('now')),
           updated_at=datetime('now')
       WHERE application_id=? AND status='pending'`
    ).bind(params.id).run();

    await env.DB.prepare(
      `UPDATE job_offers
       SET status='declined',
           responded_at=COALESCE(responded_at, CURRENT_TIMESTAMP),
           updated_at=CURRENT_TIMESTAMP
       WHERE application_id=? AND status='pending'`
    ).bind(params.id).run();

    await env.DB.prepare(
      `INSERT INTO application_status_history
       (id, application_id, status, actor_user_id, note)
       VALUES (?, ?, 'withdrawn', ?, 'Application withdrawn by candidate')`
    ).bind(newId(), params.id, user.id).run();

    await createNotification(env, {
      userId: app.employer_id,
      type: "application_withdrawn",
      title: "Application withdrawn",
      body: `${user.name || "A candidate"} withdrew their application for ${app.job_title}.`,
      applicationId: params.id,
      jobId: app.job_id,
      eventKey: `application:${params.id}:withdrawn`
    });

    await sendRecruitmentEmail(env, request, {
      userId:app.employer_id, category:"application", eventType:"application_withdrawn",
      eventKey:`email:application:${params.id}:withdrawn`,
      subject:`Application withdrawn: ${app.job_title}`,
      heading:"Application withdrawn",
      body:`${user.name || "A candidate"} withdrew their application for ${app.job_title}.`,
      applicationId:params.id, jobId:app.job_id
    });

    return json({ ok: true, status: "withdrawn" });
  }
  return { onRequestPost };
})();

// Original: functions/api/applications/[jobId].js
const _handler6 = (() => {
  const { json, requireUser } = _import0;
  async function onRequestDelete(context) {
    const { env, params } = context;
    const { user, error } = await requireUser(context, "jobseeker");
    if (error) return error;

    await env.DB.prepare("DELETE FROM applications WHERE job_id = ? AND jobseeker_id = ?")
      .bind(params.jobId, user.id).run();
    return json({ ok: true });
  }
  return { onRequestDelete };
})();

// Original: functions/api/applications/index.js
const _handler7 = (() => {
  const { json, err, newId, requireUser, createNotification } = _import0;
  const { recordAnalyticsEvent } = _import2;
  const { sendRecruitmentEmail } = _import1;
  const { assessApplicationRisk } = _import3;
  async function onRequestPost(context) {
    const { request, env } = context;
    const { user, error } = await requireUser(context, "jobseeker");
    if (error) return error;

    const body = await request.json().catch(() => null);
    const jobId = body && body.jobId;
    if (!jobId) return err("jobId is required");

    const job = await env.DB.prepare(
      "SELECT id, employer_id, title, company FROM jobs WHERE id = ? AND status = 'active'"
    ).bind(jobId).first();
    if (!job) return err("Job not found", 404);

    const blocked = await env.DB.prepare(
      `SELECT id FROM user_blocks
       WHERE (blocker_user_id=? AND blocked_user_id=?)
          OR (blocker_user_id=? AND blocked_user_id=?)
       LIMIT 1`
    ).bind(user.id, job.employer_id, job.employer_id, user.id).first();

    if (blocked) return err("This application cannot be submitted because one of the accounts is blocked.", 403);

    const id = newId();
    const insert = await env.DB.prepare(
      "INSERT OR IGNORE INTO applications (id, job_id, jobseeker_id, updated_at) VALUES (?, ?, ?, datetime(\'now\'))"
    ).bind(id, jobId, user.id).run();

    if (insert.meta?.changes) {
      await env.DB.prepare(
        `INSERT INTO application_status_history
         (id, application_id, status, actor_user_id, note)
         VALUES (?, ?, 'applied', ?, 'Application submitted')`
      ).bind(newId(), id, user.id).run();

      await createNotification(env, {
        userId: job.employer_id,
        type: "new_application",
        title: "New application",
        body: `${user.name || "A candidate"} applied for ${job.title}.`,
        applicationId: id,
        jobId,
        eventKey: `application:${id}:created`
      });

      await sendRecruitmentEmail(env, request, {
        userId:job.employer_id,
        category:"application",
        eventType:"new_application",
        eventKey:`email:application:${id}:created`,
        subject:`New application: ${job.title}`,
        heading:"You have a new application",
        body:`${user.name || "A candidate"} applied for ${job.title}.`,
        applicationId:id,
        jobId
      });

      await recordAnalyticsEvent(env, {
        userId: user.id,
        userRole: "jobseeker",
        eventType: "application_submitted",
        jobId,
        applicationId: id,
        eventKey: `application:${id}:submitted`
      });

      await assessApplicationRisk(env, user.id, id);
    }

    await env.DB.prepare("DELETE FROM skips WHERE job_id = ? AND jobseeker_id = ?").bind(jobId, user.id).run();

    return json({ ok: true }, { status: 201 });
  }
  return { onRequestPost };
})();

const ROUTES = [
  { segments:[{name:"id"}, "invite"], handler:_handler0 },
  { segments:[{name:"id"}, "offer"], handler:_handler1 },
  { segments:[{name:"id"}, "respond"], handler:_handler2 },
  { segments:[{name:"id"}, "seen"], handler:_handler3 },
  { segments:[{name:"id"}, "status"], handler:_handler4 },
  { segments:[{name:"id"}, "withdraw"], handler:_handler5 },
  { segments:[{name:"jobId"}], handler:_handler6 },
  { segments:[], handler:_handler7 },
];

function routeSegments(request) {
  const url = new URL(request.url);
  const prefix = "/api/applications";
  let pathname = url.pathname;
  if (pathname !== prefix && !pathname.startsWith(prefix + "/")) return null;
  let tail = pathname.substring(prefix.length);
  tail = tail.replace(/^\/+|\/+$/g, "");
  if (!tail) return [];
  try { return tail.split("/").map(v => decodeURIComponent(v)); }
  catch { return null; }
}

export async function onRequest(context) {
  const segments = routeSegments(context.request);
  if (segments === null) return new Response("Not Found", { status: 404 });
  for (const route of ROUTES) {
    if (segments.length !== route.segments.length) continue;
    const params = {};
    let valid = true;
    for (let i = 0; i < segments.length; i++) {
      const matcher = route.segments[i];
      if (typeof matcher === "string") {
        if (matcher !== segments[i]) { valid = false; break; }
      } else {
        if (!segments[i]) { valid = false; break; }
        params[matcher.name] = segments[i];
      }
    }
    if (!valid) continue;
    const action = route.handler["onRequest" + context.request.method.toLowerCase().replace(/^./, x => x.toUpperCase())] || route.handler.onRequest;
    if (!action) {
      const allowed = Object.keys(route.handler).filter(x => x.startsWith("onRequest") && x !== "onRequest").map(x => x.slice(9).toUpperCase());
      return new Response("Method Not Allowed", { status: 405, headers: { Allow: allowed.join(", ") } });
    }
    // Inherit original request, env, data, waitUntil and next via the context prototype.
    return action(Object.assign(Object.create(context), { params: { ...(context.params || {}), ...params } }));
  }
  return new Response("Not Found", { status: 404 });
}
