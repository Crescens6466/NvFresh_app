import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { HiArrowLeft } from "react-icons/hi2";
import "./StaticPage.css";

export default function Privacy() {
  const navigate = useNavigate();
  return (
    <div className="static-page page-fade">
      <div className="static-page-back">
        <button className="pd-back" onClick={() => navigate(-1)} aria-label="Go back">
          <HiArrowLeft />
        </button>
        <h2>Privacy Policy</h2>
      </div>

      <p className="static-meta">Last Updated: November 18, 2026</p>

      <section>
        <h4>1. Introduction</h4>
        <p>
          This Privacy Policy explains how NvFresh collects, uses, stores, and shares
          personal information when you use the NvFresh website (https://www.nvfresh.in)
          and the NvFresh Android application (together, the &ldquo;Services&rdquo;).
        </p>
        <p>
          By accessing or using our website or Android app, you acknowledge the data
          practices described in this Privacy Policy.
        </p>
      </section>

      <section>
        <h4>2. Information We Collect</h4>
        <p>
          We collect only the information needed to authenticate your account, process
          your orders, verify payments, coordinate deliveries, and send order updates.
          Depending on how you use NvFresh, this may include:
        </p>
        <ul className="static-list">
          <li>
            <strong>Contact &amp; Profile Details:</strong> Your name, mobile phone
            number, and email address (where provided, such as when signing in with
            Google).
          </li>
          <li>
            <strong>Authentication &amp; Account Identifiers:</strong> Unique account
            identifiers generated for sign-in (such as your Firebase user ID or
            phone-based customer identifier) and session authentication tokens.
          </li>
          <li>
            <strong>Delivery Information:</strong> Your delivery address and any
            delivery instructions you include with your order.
          </li>
          <li>
            <strong>Order Details:</strong> Products ordered, selected weights or
            variants, quantities, order totals, advance amounts, remaining balances,
            and order status history.
          </li>
          <li>
            <strong>Payment Records:</strong> Payment method, Razorpay order ID,
            Razorpay payment ID, payment verification signature, transaction or UPI
            reference ID, and payment status.
          </li>
          <li>
            <strong>Device &amp; Notification Information:</strong> Push notification
            device tokens and platform type (web or Android) when you enable order
            notifications, along with basic request metadata (such as IP address) used
            for OTP rate limiting and security protection.
          </li>
        </ul>
      </section>

      <section>
        <h4>3. How We Use Information</h4>
        <p>We use the information we collect for the following purposes:</p>
        <ul className="static-list">
          <li>
            <strong>Account Authentication:</strong> Verifying your identity through
            Google Sign-In or mobile OTP and maintaining your signed-in session.
          </li>
          <li>
            <strong>Order Processing:</strong> Calculating order totals, confirming
            items, and recording your order history.
          </li>
          <li>
            <strong>Delivery Coordination:</strong> Checking service-area eligibility,
            packing your items, and delivering orders to your address.
          </li>
          <li>
            <strong>Payment Verification:</strong> Creating payment orders, verifying
            completed payments, preventing duplicate charges, and reconciling payment
            status.
          </li>
          <li>
            <strong>Order &amp; Payment Notifications:</strong> Sending in-app alerts,
            push notifications, and order status updates regarding your orders and
            payments.
          </li>
          <li>
            <strong>Customer Support:</strong> Responding to questions, resolving
            delivery or payment issues, and assisting with support requests.
          </li>
          <li>
            <strong>Security &amp; Fraud Prevention:</strong> Protecting accounts and
            transactions against unauthorized access, OTP abuse, duplicate submissions,
            and payment tampering.
          </li>
        </ul>
      </section>

      <section>
        <h4>4. Payment Processing</h4>
        <p>
          Online payments on the NvFresh website and Android application are processed
          by <strong>Razorpay</strong>. When you choose to pay online, Razorpay
          collects and processes your payment credentials directly through its secure
          checkout interface in accordance with Razorpay&rsquo;s own privacy policy and
          security standards.
        </p>
        <p>
          NvFresh does <strong>not</strong> collect, see, or store your debit/credit
          card numbers, CVV, UPI PINs, or net banking passwords.
        </p>
        <p>
          To confirm your payment and maintain accurate order records, NvFresh receives
          and retains transaction metadata such as your Razorpay order ID, Razorpay
          payment ID, cryptographic verification signature, payment amount, payment
          method, transaction reference ID, and payment status. For legacy manual UPI
          orders, we retain the UPI transaction reference ID submitted with the order.
        </p>
      </section>

      <section>
        <h4>5. Third-Party Services &amp; Data Sharing</h4>
        <p>
          NvFresh does not sell your personal information. However, operating our
          website, Android app, payments, and delivery workflow requires sharing
          relevant information with the following third-party service providers and
          fulfilment partners:
        </p>
        <ul className="static-list">
          <li>
            <strong>Google &amp; Firebase Services:</strong> Used for Google Sign-In,
            Firebase Authentication, and Firebase Cloud Messaging (FCM) to deliver push
            notifications to your web browser or Android device.
          </li>
          <li>
            <strong>Razorpay:</strong> Used to initiate, process, and verify online
            payments. Order amount, currency, and customer contact details (name, phone
            number, email where available, and delivery address notes) may be shared
            with Razorpay during checkout.
          </li>
          <li>
            <strong>MSG91:</strong> Used to send and verify one-time passwords (OTPs)
            for mobile phone sign-in on our website and Android app.
          </li>
          <li>
            <strong>MongoDB Atlas &amp; Vercel:</strong> Used as our cloud database and
            application/API hosting infrastructure to securely store and process
            account, order, notification, and product data.
          </li>
          <li>
            <strong>Telegram (Internal Order Notifications):</strong> Used by NvFresh
            internally to send new-order packing and delivery summaries (including
            order ID, customer name, mobile number, ordered items, delivery address,
            and payment summary) to our internal operations team.
          </li>
          <li>
            <strong>Messaging Services (WhatsApp / SMS):</strong> Where enabled, your
            mobile number and basic order update details may be transmitted through
            configured messaging gateways (such as Meta WhatsApp Cloud API or SMS
            gateways) to deliver OTPs or order status notifications.
          </li>
          <li>
            <strong>Suppliers &amp; Delivery Personnel:</strong> Authorized suppliers,
            packing staff, and delivery personnel receive the customer information
            strictly required to prepare, pack, and deliver your order (such as your
            name, phone number, delivery address, ordered items, and any remaining
            balance due on delivery).
          </li>
        </ul>
        <p>
          We may also disclose information where required to comply with applicable
          laws, lawful government requests, or to protect the rights, safety, and
          security of NvFresh and our customers.
        </p>
      </section>

      <section>
        <h4>6. Data Storage and Retention</h4>
        <p>
          Customer profiles, order details, payment references, and push notification
          device tokens are stored in our cloud database hosted on MongoDB Atlas. Basic
          convenience data such as your shopping cart items and sign-in session are
          also stored locally on your browser or Android device until you clear app
          data or sign out.
        </p>
        <p>
          We retain personal information only for as long as reasonably necessary to
          provide our Services, fulfil orders, maintain order history, resolve
          disputes, and comply with legal obligations. Even if you request deletion of
          your personal data, certain financial, order, and payment transaction records
          may be retained for the period required under applicable tax, accounting,
          audit, and regulatory laws.
        </p>
      </section>

      <section>
        <h4>7. Data Security</h4>
        <p>
          We implement reasonable technical and organisational safeguards designed to
          protect your information, including encrypted HTTPS/TLS communication in
          transit, authenticated API access, server-side order total calculation,
          cryptographic payment signature verification, hashed storage of temporary
          OTPs, and restricted access to administrative systems.
        </p>
        <p>
          While we work to safeguard your personal information, no method of internet
          transmission or electronic storage is completely secure, and we cannot
          guarantee absolute security.
        </p>
      </section>

      <section>
        <h4>8. Customer Privacy Rights</h4>
        <p>
          You may request access to, correction of, or deletion of personal information
          NvFresh holds about you by contacting us at{" "}
          <a href="mailto:support@nvfresh.in" className="static-link">
            support@nvfresh.in
          </a>
          . You may also disable push notifications at any time through your Android
          device or browser settings, and signing out removes your active push device
          token from our server.
        </p>
        <p>
          To protect your privacy and security, we may ask you to verify your identity
          (for example, by confirming your registered mobile number or email address)
          before acting on a request. Please note that certain requests may be limited
          where retention is required for legal, tax, accounting, fraud-prevention, or
          financial record-keeping purposes.
        </p>
      </section>

      <section>
        <h4>9. Account Deletion</h4>
        <p>
          You can permanently delete your NvFresh account directly in the NvFresh
          Android application (under <strong>Profile &rarr; Delete Account</strong>) or
          online through our dedicated Account Deletion page at{" "}
          <Link to="/delete-account" className="static-link">
            https://www.nvfresh.in/delete-account
          </Link>{" "}
          after verifying your identity.
        </p>
        <p>
          If you cannot sign in to your account, you may also request account deletion
          by emailing{" "}
          <a href="mailto:support@nvfresh.in" className="static-link">
            support@nvfresh.in
          </a>{" "}
          with the subject line &ldquo;Account Deletion Request&rdquo; and providing
          your registered mobile number or email address so we can verify your
          identity before processing the request.
        </p>
        <p>
          When your verified deletion request is completed, NvFresh removes your
          customer profile information, unregisters push notification device tokens,
          deletes in-app notification records, revokes and deletes your Firebase
          Authentication account (where applicable), and anonymizes personal contact
          details on completed historical orders. Essential financial and payment
          transaction records (such as order IDs, amounts, Razorpay/UPI payment IDs,
          and timestamps) are retained where required for accounting, tax, audit,
          fraud-prevention, or legal compliance.
        </p>
      </section>

      <section>
        <h4>10. Contact Information</h4>
        <p>
          If you have any questions, concerns, or privacy requests regarding this
          Privacy Policy or how NvFresh handles your information, please contact us at:{" "}
          <a href="mailto:support@nvfresh.in" className="static-link">
            support@nvfresh.in
          </a>
          .
        </p>
      </section>

      <section>
        <h4>11. Policy Updates</h4>
        <p>
          We may update this Privacy Policy from time to time to reflect changes in our
          Services, third-party integrations, or legal requirements. The latest version
          will always be published at{" "}
          <a href="https://www.nvfresh.in/privacy" className="static-link">
            https://www.nvfresh.in/privacy
          </a>{" "}
          with an updated &ldquo;Last Updated&rdquo; date. For material changes, we may
          also notify customers through the website, the Android application, or
          available contact information.
        </p>
      </section>
    </div>
  );
}
