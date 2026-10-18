import { json } from "../../_lib/db.js";
import { TERMS_VERSION, PRIVACY_VERSION } from "../../_lib/policy.js";

export async function onRequestGet({ env }) {
  const { results } = await env.DB.prepare("SELECT setting_key AS key, setting_value AS value FROM legal_settings").all();
  const settings = Object.fromEntries((results || []).map(r => [r.key, r.value]));
  return json({
    termsVersion: TERMS_VERSION,
    privacyVersion: PRIVACY_VERSION,
    controllerName: settings.controller_name || "",
    controllerAddress: settings.controller_address || "",
    companyRegistration: settings.company_registration || "",
    privacyEmail: settings.privacy_email || "",
    supportEmail: settings.support_email || "",
    dpoEmail: settings.dpo_email || "",
    dsaContactEmail: settings.dsa_contact_email || "",
    country: settings.country || "Ireland"
  }, { headers: { "Cache-Control":"no-store" } });
}
