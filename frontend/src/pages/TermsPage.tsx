import { useEffect } from "react";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

export default function TermsPage() {
  useEffect(() => { window.scrollTo(0, 0); }, []);

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 pt-32 pb-20">
        <h1 className="text-3xl sm:text-4xl font-bold text-slate-900 mb-2">Terms &amp; Conditions</h1>
        <p className="text-sm text-slate-500 mb-10">Last updated: 28 April 2026</p>

        <div className="prose prose-slate max-w-none prose-headings:text-slate-900 prose-h2:text-xl prose-h2:font-bold prose-h2:mt-10 prose-h2:mb-4 prose-h3:text-lg prose-h3:font-semibold prose-h3:mt-6 prose-h3:mb-3 prose-p:text-slate-600 prose-p:leading-relaxed prose-li:text-slate-600 prose-a:text-primary prose-a:no-underline hover:prose-a:underline">

          <h2>1. Introduction &amp; Acceptance</h2>
          <p>
            These Terms and Conditions ("Terms") govern your access to and use of the Stegofy platform, including the website at stegotags.com, the Stegofy mobile web application, and all related products and services (collectively, the "Platform"), operated by Stegofy ("we," "our," or "us").
          </p>
          <p>
            By creating an account, purchasing products, scanning a QR tag, or otherwise using the Platform, you agree to be bound by these Terms. If you do not agree, please do not use the Platform.
          </p>

          <h2>2. Definitions</h2>
          <ul>
            <li><strong>"QR Tag"</strong> — a physical product (sticker, band, card, or tag) containing a unique QR code linked to a digital profile on the Platform</li>
            <li><strong>"User" / "Owner"</strong> — a registered individual who creates and manages QR tag profiles</li>
            <li><strong>"Scanner"</strong> — any person who scans a Stegofy QR code to view or interact with the linked profile</li>
            <li><strong>"Masked Call"</strong> — a phone call routed through our telephony infrastructure where neither party's real phone number is revealed</li>
            <li><strong>"PIN"</strong> — a 4-digit personal identification number assigned to each QR tag for verification purposes</li>
          </ul>

          <h2>3. Account Registration &amp; Eligibility</h2>
          <ul>
            <li>You must be at least 18 years old to create a Stegofy account</li>
            <li>You must provide a valid Indian mobile phone number for OTP-based authentication</li>
            <li>You are responsible for maintaining the confidentiality of your account and all activities under it</li>
            <li>One phone number may be associated with one account only</li>
            <li>We reserve the right to suspend or terminate accounts that violate these Terms</li>
          </ul>

          <h2>4. QR Tag Products &amp; Services</h2>

          <h3>4.1 Product Categories</h3>
          <p>Stegofy offers QR-based identification products including but not limited to:</p>
          <ul>
            <li>Vehicle parking tags</li>
            <li>Pet identification tags</li>
            <li>Child safety bands</li>
            <li>Medical alert tags</li>
            <li>Luggage tags</li>
            <li>NFC-enabled business cards</li>
          </ul>

          <h3>4.2 QR Profile Management</h3>
          <ul>
            <li>You are solely responsible for the accuracy and appropriateness of information you add to your QR tag profiles</li>
            <li>You may update, disable, or delete your QR profiles at any time through the Platform</li>
            <li>Disabling contact features on a QR tag will prevent strangers from initiating calls or messages through that tag</li>
          </ul>

          <h3>4.3 Masked Communication</h3>
          <ul>
            <li>Calls and messages initiated through QR tags are routed through third-party telephony providers</li>
            <li>Neither the scanner nor the tag owner will see each other's real phone numbers</li>
            <li>Calls are subject to configurable duration limits (default 60 seconds) and will be automatically disconnected when the limit is reached</li>
            <li>Rate limits apply: a maximum number of calls per QR tag per hour, with cooldown periods between calls</li>
            <li>We reserve the right to modify call limits and communication features without prior notice</li>
          </ul>

          <h2>5. Orders, Payments &amp; Shipping</h2>

          <h3>5.1 Placing Orders</h3>
          <ul>
            <li>All prices are listed in Indian Rupees (INR) and are inclusive of applicable taxes unless otherwise stated</li>
            <li>We reserve the right to modify prices at any time without prior notice; prices at the time of order placement will apply</li>
            <li>An order is confirmed only after successful payment processing or COD acceptance</li>
          </ul>

          <h3>5.2 Payment Methods</h3>
          <ul>
            <li>Cash on Delivery (COD) — available for eligible pin codes</li>
            <li>Online payment — processed through secure third-party payment gateways</li>
            <li>We do not store your credit card, debit card, or bank account details on our servers</li>
          </ul>

          <h3>5.3 Shipping &amp; Delivery</h3>
          <ul>
            <li>Orders are fulfilled through our logistics partner (Shiprocket) and their courier network</li>
            <li>Estimated delivery times are approximate and not guaranteed</li>
            <li>Shipping charges are calculated at checkout based on delivery pincode, package weight, and selected courier</li>
            <li>Tracking information (AWB number, courier name, tracking URL) will be provided once the order is shipped</li>
            <li>Risk of loss or damage passes to you upon delivery by the courier</li>
          </ul>

          <h2 id="refund">6. Refund &amp; Cancellation Policy</h2>

          <h3>6.1 Order Cancellation</h3>
          <ul>
            <li>Orders may be cancelled before shipment by contacting our support team</li>
            <li>Once an order has been shipped, it cannot be cancelled — you may initiate a return instead</li>
          </ul>

          <h3>6.2 Returns</h3>
          <ul>
            <li>Returns are accepted within 7 days of delivery for products that are defective, damaged during transit, or materially different from the description</li>
            <li>QR tags that have been affixed, activated, or linked to a profile are not eligible for return unless defective</li>
            <li>To initiate a return, contact our support team with your order ID and reason for return</li>
          </ul>

          <h3>6.3 Refunds</h3>
          <ul>
            <li>Approved refunds will be processed within 7–10 business days</li>
            <li>Refunds for online payments will be credited to the original payment method</li>
            <li>Refunds for COD orders will be processed via bank transfer (you will need to provide bank details)</li>
            <li>Shipping charges are non-refundable unless the return is due to our error or a defective product</li>
          </ul>

          <h2>7. Privacy &amp; Data Protection</h2>
          <p>
            Your use of the Platform is also governed by our <a href="/privacy">Privacy Policy</a>, which describes how we collect, use, and protect your personal information. By using the Platform, you consent to our data practices as described in the Privacy Policy.
          </p>

          <h2>8. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul>
            <li>Use the Platform for any unlawful, fraudulent, or malicious purpose</li>
            <li>Misuse the masked calling feature to harass, threaten, or spam QR tag owners</li>
            <li>Attempt to bypass rate limits, PIN verification, or other security measures</li>
            <li>Create QR profiles with false, misleading, or offensive content</li>
            <li>Reverse-engineer, decompile, or attempt to extract the source code of the Platform</li>
            <li>Interfere with or disrupt the Platform's infrastructure or other users' experience</li>
            <li>Scrape, harvest, or collect data from the Platform using automated means</li>
            <li>Use the Platform to send unsolicited commercial messages</li>
          </ul>

          <h2>9. Intellectual Property</h2>
          <ul>
            <li>The Stegofy name, logo, branding, and all Platform content (excluding user-generated content) are our intellectual property</li>
            <li>You retain ownership of content you upload to your QR profiles</li>
            <li>By uploading content, you grant us a non-exclusive, worldwide licence to display that content as part of the QR tag profile functionality</li>
            <li>You may not use our trademarks, logos, or branding without prior written permission</li>
          </ul>

          <h2>10. Limitation of Liability</h2>
          <p>To the maximum extent permitted by applicable law:</p>
          <ul>
            <li>The Platform is provided "as is" and "as available" without warranties of any kind, whether express or implied</li>
            <li>We do not guarantee uninterrupted, error-free, or secure operation of the Platform</li>
            <li>We are not liable for any indirect, incidental, consequential, or punitive damages arising from your use of the Platform</li>
            <li>Our total liability for any claim related to the Platform shall not exceed the amount you paid to us in the 12 months preceding the claim</li>
            <li>We are not responsible for the actions of strangers who scan QR codes, including any misuse of information displayed on QR profiles</li>
          </ul>

          <h2>11. Disclaimers</h2>
          <ul>
            <li>Stegofy QR tags are identification and communication tools — they are not substitutes for emergency services, medical devices, or security systems</li>
            <li>We do not guarantee that a scanned QR tag will result in a successful contact or call connection</li>
            <li>Masked call connectivity depends on third-party telephony providers and network availability</li>
            <li>Delivery timelines depend on courier partners and are outside our direct control</li>
            <li>QR tag durability depends on environmental conditions and proper installation</li>
          </ul>

          <h2>12. Indemnification</h2>
          <p>
            You agree to indemnify, defend, and hold harmless Stegofy, its officers, directors, employees, and agents from any claims, damages, losses, liabilities, and expenses (including legal fees) arising from your use of the Platform, violation of these Terms, or infringement of any third-party rights.
          </p>

          <h2>13. Termination</h2>
          <ul>
            <li>You may delete your account at any time through the Platform or by contacting support</li>
            <li>We may suspend or terminate your account immediately if you violate these Terms</li>
            <li>Upon termination, your QR tag profiles will be deactivated and your personal data will be handled in accordance with our Privacy Policy</li>
            <li>Sections relating to intellectual property, limitation of liability, indemnification, and governing law survive termination</li>
          </ul>

          <h2>14. Governing Law &amp; Dispute Resolution</h2>
          <ul>
            <li>These Terms are governed by and construed in accordance with the laws of India</li>
            <li>Any disputes arising from these Terms or your use of the Platform shall be subject to the exclusive jurisdiction of the courts in Hyderabad, Telangana, India</li>
            <li>Before initiating legal proceedings, both parties agree to attempt resolution through good-faith negotiation for a period of 30 days</li>
          </ul>

          <h2>15. Changes to These Terms</h2>
          <p>
            We may modify these Terms at any time. When we make material changes, we will update the "Last updated" date at the top of this page. Your continued use of the Platform after changes constitutes acceptance of the revised Terms. We encourage you to review these Terms periodically.
          </p>

          <h2>16. Contact Us</h2>
          <p>If you have questions about these Terms, contact us:</p>
          <ul>
            <li><strong>Email:</strong> legal@stegotags.com</li>
            <li><strong>Platform:</strong> <a href="https://stegotags.com">stegotags.com</a></li>
          </ul>
        </div>
      </main>
      <Footer />
    </div>
  );
}
