"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import styles from "./ContactOverlayContent.module.css";

const CONTACT_EMAIL = "hello@lyongraulty.com";

type FormStatus = {
  message: string;
  isError: boolean;
};

function validateContactForm(values: {
  name: string;
  email: string;
  subject: string;
  message: string;
}) {
  if (values.name.length < 2) return "Please enter your name.";
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) return "Please enter a valid email address.";
  if (values.subject.length < 2) return "Please enter a subject.";
  if (values.message.length < 10) return "Please add at least 10 characters in your message.";
  return "";
}

export function ContactOverlayContent() {
  const [isCopied, setIsCopied] = useState(false);
  const [copyCount, setCopyCount] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState<FormStatus>({ message: "", isError: false });
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(CONTACT_EMAIL);
    } catch {
      const fallback = document.createElement("textarea");
      fallback.value = CONTACT_EMAIL;
      fallback.setAttribute("readonly", "");
      fallback.style.position = "absolute";
      fallback.style.left = "-9999px";
      document.body.appendChild(fallback);
      fallback.select();
      document.execCommand("copy");
      document.body.removeChild(fallback);
    }

    setCopyCount((prev) => prev + 1);
    setIsCopied(true);
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => setIsCopied(false), 1600);
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formElement = event.currentTarget;
    const formData = new FormData(formElement);

    const payload = {
      name: String(formData.get("name") ?? "").trim(),
      email: String(formData.get("email") ?? "").trim(),
      subject: String(formData.get("subject") ?? "").trim(),
      message: String(formData.get("message") ?? "").trim(),
    };

    const validationError = validateContactForm(payload);
    if (validationError) {
      setStatus({ message: validationError, isError: true });
      return;
    }

    setStatus({ message: "", isError: false });
    setIsSubmitting(true);

    try {
      const response = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const responseJson = (await response.json().catch(() => null)) as
        | { ok?: boolean; error?: string }
        | null;

      if (!response.ok || responseJson?.ok === false) {
        throw new Error(responseJson?.error ?? "Unable to send message");
      }

      formElement.reset();
      setStatus({ message: "Message sent. Thanks for reaching out.", isError: false });
    } catch {
      setStatus({ message: "Could not send message. Please try again.", isError: true });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.root}>
      <div className={styles.systemBar}>
        <p>Contact</p>
        <p>Austin, TX &mdash; Remote available</p>
      </div>

      <div className={styles.inner}>
        {/* left: copy */}
        <div className={styles.copyPanel}>
          <h1 className={styles.title}>Let&apos;s<br />talk</h1>

          <div className={styles.copyBody}>
            <p>Get in touch to inquire about pricing details or arrange a booking.</p>
            <p>I&apos;d love to hear about your goals and show you how motion design can fit into your strategy.</p>
            <p>I work mostly day rate but can arrange a project-based bid.</p>
            <p>Remote or in studio in the Austin, TX area.</p>
          </div>

          <div className={styles.divider} />

          <a className={styles.emailLink} href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>

          <div className={styles.copyRow}>
            <button type="button" className={styles.submitBtn} onClick={handleCopy}>
              Copy Email
            </button>
            {isCopied ? (
              <span key={copyCount} className={styles.copyNote} role="status" aria-live="polite">
                Copied!
              </span>
            ) : null}
          </div>

          <div className={styles.socials}>
            <a className={styles.socialBtn} href="https://www.instagram.com/lyongraulty" target="_blank" rel="noopener noreferrer">Instagram</a>
            <a className={styles.socialBtn} href="https://www.linkedin.com/in/lyongraulty" target="_blank" rel="noopener noreferrer">LinkedIn</a>
            <a className={styles.socialBtn} href="https://www.pinterest.com/lyongraulty" target="_blank" rel="noopener noreferrer">Pinterest</a>
          </div>
        </div>

        {/* right: form */}
        <div className={styles.formPanel}>
          <p className={styles.formLabel}>Send a message</p>

          <form className={styles.form} aria-label="Contact form" onSubmit={handleSubmit}>
            <div className={styles.field}>
              <label htmlFor="contact-name">Name</label>
              <input id="contact-name" name="name" type="text" autoComplete="name" placeholder="Your name" required minLength={2} />
            </div>
            <div className={styles.field}>
              <label htmlFor="contact-email">Email</label>
              <input id="contact-email" name="email" type="email" autoComplete="email" placeholder="your@email.com" required />
            </div>
            <div className={styles.field}>
              <label htmlFor="contact-subject">Subject</label>
              <input id="contact-subject" name="subject" type="text" autoComplete="off" placeholder="What's this about?" required minLength={2} />
            </div>
            <div className={styles.field}>
              <label htmlFor="contact-message">Message</label>
              <textarea id="contact-message" name="message" rows={4} placeholder="Tell me about the project..." required minLength={10} />
            </div>

            <div className={styles.submitRow}>
              <button type="submit" className={styles.submitBtn} disabled={isSubmitting}>
                {isSubmitting ? "Sending..." : "Send Message"}
              </button>
              {status.message ? (
                <p
                  className={`${styles.formStatus}${status.isError ? ` ${styles.formStatusError}` : ""}`}
                  role="status"
                  aria-live="polite"
                >
                  {status.message}
                </p>
              ) : null}
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
