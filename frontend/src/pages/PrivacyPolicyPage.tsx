import { useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function PrivacyPolicyPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-32 pb-20">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">Privacy Policy</h1>
        <p className="text-sm text-slate-500 mb-10">Last updated: 28 April 2026</p>

        <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-h2:text-xl prose-h2:font-bold prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-3 prose-p:text-slate-600 prose-p:leading-relaxed prose-li:text-slate-600 prose-a:text-primary prose-a:no-underline hover:prose-a:underline">

          <h2>1. Introduction</h2>
          <p>
            Stegofy ("we," "our," or "us") operates the Stegofy platform, including the website at stegotags.com and the Stegofy mobile web application (collectively, the "Platform"). We provide QR-based identification and safety products — including vehicle parking tags, pet ID tags, child safety bands, medical alert tags, luggage tags, and NFC cards — along with related communication and e-commerce services.
          </p>
          <p>
            This Privacy Policy explains how we collect, use, store, share, and protect your personal information when you use our Platform. By accessing or using Stegofy, you agree to the terms of this Privacy Policy.
          </p>

          <h2>2. Information We Collect</h2>

          <h3>2.1 Account Information</h3>
          <p>When you create an account, we collect:</p>
          <ul>
            <li>Mobile phone number (used for OTP-based authentication)</li>
            <li>Name and email address (optional, provided during profile setup)</li>
            <li>Authentication tokens and session data</li>
          </ul>

          <h3>2.2 QR Profile Data</h3>
          <p>When you create or manage a QR tag profile, we collect:</p>
          <ul>
            <li>Vehicle registration number, pet details, medical information, or other profile data you choose to provide</li>
            <li>Emergency contact phone number</li>
            <li>4-digit PIN code (used for verification when strangers contact you)</li>
            <li>Profile privacy settings and contact preferences</li>
          </ul>

          <h3>2.3 QR Scan Data</h3>
          <p>When someone scans a Stegofy QR code, we collect:</p>
          <ul>
            <li>IP address — stored in three forms: masked (last octet zeroed), hashed (irreversible HMAC-SHA256), and encrypted (AES-256-CBC, reversible only by authorised administrators)</li>
            <li>Approximate geolocation derived from IP (city, state, country, pincode)</li>
            <li>Device type, browser, and operating system</li>
            <li>Scan timestamp and session identifier</li>
            <li>Selected intent (e.g., "contact owner," "emergency")</li>
          </ul>

          <h3>2.4 Communication Data</h3>
          <p>When contact requests or calls are made through the Platform:</p>
          <ul>
            <li>Requester's phone number — stored in plaintext in the contact request record (visible to administrators only, never exposed to QR owners)</li>
            <li>Phone numbers in call logs and message logs are stored as irreversible HMAC-SHA256 hashes — the original numbers cannot be recovered from these records</li>
            <li>Call duration, status, and cost (for masked calls via Exotel)</li>
            <li>Message delivery status and channel used (WhatsApp or SMS)</li>
            <li>OTP codes are stored as hashes with automatic expiry</li>
          </ul>

          <h3>2.5 Order &amp; Payment Information</h3>
          <p>When you purchase products:</p>
          <ul>
            <li>Shipping address (name, phone, address, city, state, pincode)</li>
            <li>Order details, item quantities, and pricing</li>
            <li>Payment method (Cash on Delivery or online payment)</li>
            <li>We do not store credit card numbers, bank account details, or UPI IDs on our servers</li>
          </ul>

          <h3>2.6 Automatically Collected Data</h3>
          <ul>
            <li>Browser type, device information, and screen resolution</li>
            <li>Pages visited, time spent, and navigation patterns</li>
            <li>Referral source and UTM parameters</li>
          </ul>

          <h2>3. How We Use Your Information</h2>
          <p>We use your information to:</p>
          <ul>
            <li>Provide and operate the Stegofy Platform and QR tag services</li>
            <li>Authenticate your identity via phone OTP</li>
            <li>Facilitate masked calls and messages between QR scanners and tag owners — without revealing either party's real phone number</li>
            <li>Process and ship product orders via our logistics partner</li>
            <li>Send transactional notifications (order updates, OTP codes, contact alerts)</li>
            <li>Monitor scan activity and provide analytics to QR tag owners</li>
            <li>Detect and prevent fraud, abuse, and rate-limit violations</li>
            <li>Improve our products, services, and user experience</li>
            <li>Comply with legal obligations</li>
          </ul>

          <h2>4. Masked Calling &amp; Number Privacy</h2>
          <p>
            A core feature of Stegofy is masked calling. When a stranger contacts a QR tag owner through our Platform, the call is routed through our telephony partner (Exotel). Neither party sees the other's real phone number — both see the Stegofy ExoPhone number. This ensures:
          </p>
          <ul>
            <li>The QR tag owner's personal number is never exposed to strangers</li>
            <li>The stranger's number is never shown to the QR tag owner</li>
            <li>Call logs store only hashed phone numbers (HMAC-SHA256) — the original numbers are not recoverable from these logs</li>
            <li>Calls have configurable duration limits and are automatically disconnected when the limit is reached</li>
          </ul>

          <h2>5. Cookies &amp; Local Storage</h2>
          <p>We use:</p>
          <ul>
            <li><strong>Authentication tokens</strong> — stored in local storage to maintain your login session</li>
            <li><strong>Cart data</strong> — stored in local storage for your shopping cart</li>
            <li><strong>QR profile cache</strong> — stored in local storage to reduce loading times</li>
          </ul>
          <p>We do not use third-party advertising cookies or cross-site tracking technologies.</p>

          <h2>6. Data Sharing &amp; Third Parties</h2>
          <p>We share your information with the following service providers, strictly for operating the Platform:</p>
          <ul>
            <li><strong>Supabase</strong> — database hosting, authentication, and row-level security (servers in Singapore)</li>
            <li><strong>Exotel</strong> — masked calling, SMS delivery, and WhatsApp messaging</li>
            <li><strong>Zavu</strong> — primary WhatsApp message delivery</li>
            <li><strong>Shiprocket</strong> — order shipping, courier assignment, and delivery tracking</li>
            <li><strong>Render</strong> — application hosting (Singapore region)</li>
            <li><strong>Resend</strong> — transactional email delivery</li>
          </ul>
          <p>
            We do not sell, rent, or trade your personal information to third parties for marketing purposes. We may disclose information if required by law, court order, or government regulation.
          </p>

          <h2>7. Data Security</h2>
          <p>We implement multiple layers of security to protect your data:</p>
          <ul>
            <li><strong>Phone number hashing</strong> — caller and callee numbers in communication logs are stored as irreversible HMAC-SHA256 hashes</li>
            <li><strong>IP address encryption</strong> — scan IPs are encrypted with AES-256-CBC; only authorised administrators can decrypt them</li>
            <li><strong>Row-Level Security (RLS)</strong> — Supabase enforces database-level access controls ensuring users can only access their own data</li>
            <li><strong>Server-only tables</strong> — sensitive communication logs (call_logs, message_logs, otp_codes) have RLS policies that block all frontend access; only the backend service role can read them</li>
            <li><strong>HTTPS/TLS</strong> — all data in transit is encrypted</li>
            <li><strong>Webhook signature verification</strong> — HMAC-SHA256 verification on all incoming webhooks from Exotel and Zavu</li>
            <li><strong>Rate limiting</strong> — per-phone and per-QR rate limits on OTPs, calls, and messages to prevent abuse</li>
          </ul>

          <h2>8. Data Retention</h2>
          <ul>
            <li><strong>Account data</strong> — retained as long as your account is active; deleted upon account deletion</li>
            <li><strong>QR scan records</strong> — retained indefinitely for analytics; IP data is hashed/encrypted</li>
            <li><strong>Communication logs</strong> — retained for 12 months for dispute resolution and audit purposes</li>
            <li><strong>OTP codes</strong> — automatically expire after 15 minutes and are marked as consumed</li>
            <li><strong>Order records</strong> — retained for 5 years as required by Indian tax regulations</li>
          </ul>

          <h2>9. Your Rights</h2>
          <p>You have the right to:</p>
          <ul>
            <li><strong>Access</strong> — request a copy of the personal data we hold about you</li>
            <li><strong>Correction</strong> — update or correct inaccurate personal information</li>
            <li><strong>Deletion</strong> — request deletion of your account and associated personal data</li>
            <li><strong>Portability</strong> — receive your data in a structured, machine-readable format</li>
            <li><strong>Withdraw consent</strong> — disable contact features on your QR tags at any time through your profile settings</li>
            <li><strong>Opt-out</strong> — unsubscribe from promotional communications (transactional messages like OTPs and order updates cannot be opted out of while your account is active)</li>
          </ul>
          <p>
            To exercise any of these rights, contact us at <strong>privacy@stegotags.com</strong>.
          </p>

          <h2>10. Children's Privacy</h2>
          <p>
            Stegofy child safety products are designed to be managed by parents or legal guardians. Children under 18 cannot create accounts independently. The child safety QR tag profiles are created and managed by the parent/guardian, and any scan-initiated communication is directed to the parent/guardian's registered phone number.
          </p>

          <h2>11. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy from time to time. When we make material changes, we will notify you by posting the updated policy on this page and updating the "Last updated" date. Your continued use of the Platform after changes constitutes acceptance of the revised policy.
          </p>

          <h2>12. Contact Us</h2>
          <p>If you have any questions about this Privacy Policy or our data practices, contact us:</p>
          <ul>
            <li><strong>Email:</strong> privacy@stegotags.com</li>
            <li><strong>Platform:</strong> <a href="https://stegotags.com">stegotags.com</a></li>
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  );
}
