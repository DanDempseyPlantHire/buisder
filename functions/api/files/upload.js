import { json, err, requireUser } from "../../_lib/db.js";

const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);
const CV_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/octet-stream"
]);

function extension(name) {
  const m = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return m ? m[1] : "";
}

function safeFilename(name) {
  return String(name || "file")
    .replace(/[^\w.\- ()]/g, "_")
    .slice(0, 120);
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const { user, error } = await requireUser(context);
  if (error) return error;

  if (!env.FILES) return err("R2 storage is not configured. Check the FILES binding.", 500);

  const form = await request.formData().catch(() => null);
  if (!form) return err("Invalid upload");

  const kind = String(form.get("kind") || "");
  const file = form.get("file");

  if (!file || typeof file.arrayBuffer !== "function") return err("Choose a file to upload");

  let key = "";
  let maxBytes = 0;

  if (kind === "profile-photo") {
    if (user.role !== "jobseeker") return err("Job seeker account required", 403);
    if (!IMAGE_TYPES.has(file.type)) return err("Profile photo must be JPG, PNG or WebP");
    maxBytes = 5 * 1024 * 1024;
    key = `profile-photos/${user.id}/current`;
  } else if (kind === "business-logo") {
    if (user.role !== "employer") return err("Employer account required", 403);
    if (!IMAGE_TYPES.has(file.type)) return err("Business image must be JPG, PNG or WebP");
    maxBytes = 5 * 1024 * 1024;
    key = `business-logos/${user.id}/current`;
  } else if (kind === "cv") {
    if (user.role !== "jobseeker") return err("Job seeker account required", 403);
    const ext = extension(file.name);
    if (!["pdf", "doc", "docx"].includes(ext)) return err("CV must be PDF, DOC or DOCX");
    if (!CV_TYPES.has(file.type || "application/octet-stream")) return err("Unsupported CV file type");
    maxBytes = 10 * 1024 * 1024;
    key = `cvs/${user.id}/current`;
  } else {
    return err("Unsupported upload type");
  }

  if (file.size <= 0) return err("The selected file is empty");
  if (file.size > maxBytes) {
    return err(kind === "cv" ? "CV must be under 10 MB" : "Image must be under 5 MB");
  }

  const originalName = safeFilename(file.name);
  const contentType = file.type || "application/octet-stream";
  const data = await file.arrayBuffer();

  await env.FILES.put(key, data, {
    httpMetadata: { contentType },
    customMetadata: {
      originalName,
      uploadedBy: user.id,
      uploadedAt: new Date().toISOString()
    }
  });

  if (kind === "profile-photo") {
    await env.DB.prepare(
      "UPDATE jobseeker_profiles SET photo_key=?, photo_data=NULL WHERE user_id=?"
    ).bind(key, user.id).run();
  } else if (kind === "business-logo") {
    await env.DB.prepare(
      "UPDATE employer_profiles SET logo_key=?, logo_data=NULL WHERE user_id=?"
    ).bind(key, user.id).run();
  } else {
    await env.DB.prepare(
      `UPDATE jobseeker_profiles
       SET cv_key=?, cv_filename=?, cv_content_type=?, cv_size=?
       WHERE user_id=?`
    ).bind(key, originalName, contentType, file.size, user.id).run();
  }

  const publicKind = kind === "profile-photo" ? "profile-photo"
    : kind === "business-logo" ? "business-logo"
    : "cv";

  return json({
    ok: true,
    kind,
    filename: originalName,
    size: file.size,
    url: `/api/files/${publicKind}/${user.id}`
  });
}
