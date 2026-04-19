"use client";

import { FormEvent, useEffect, useRef, useState } from "react";

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
  if (values.name.length < 2) {
    return "Please enter your name.";
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email)) {
    return "Please enter a valid email address.";
  }

  if (values.subject.length < 2) {
    return "Please enter a subject.";
  }

  if (values.message.length < 10) {
    return "Please add at least 10 characters in your message.";
  }

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
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }
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
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
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
        headers: {
          "Content-Type": "application/json",
        },
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
    <div className="contact-content">
      <div className="contact-copy">
        <h1 className="contact-title">Let&apos;s talk</h1>
        <p>Get in touch to inquire about pricing details or arrange a booking.</p>
        <p>
          I&apos;d love to hear about your goals and show you how motion design can fit into your strategy.
        </p>
        <p>I work mostly day rate but can arrange a project based bid.</p>
        <p>Remote or in studio in the Austin, TX area.</p>
        <p>You can email me directly or, if a form is more your jam, fill it in here.</p>
        <div className="contact-email-row">
          <a className="contact-email" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
          <div className="contact-copy-row">
            <button type="button" className="project-button type-button" onClick={handleCopy}>
              COPY EMAIL
            </button>
            {isCopied ? (
              <span key={copyCount} className="contact-copy-note" role="status" aria-live="polite">
                Email copied!
              </span>
            ) : null}
          </div>
        </div>
      </div>

      <form className="contact-form" aria-label="Contact form" onSubmit={handleSubmit}>
        <div className="contact-field">
          <label htmlFor="contact-name">Name</label>
          <input id="contact-name" name="name" type="text" autoComplete="name" required minLength={2} />
        </div>
        <div className="contact-field">
          <label htmlFor="contact-email">Email</label>
          <input id="contact-email" name="email" type="email" autoComplete="email" required />
        </div>
        <div className="contact-field">
          <label htmlFor="contact-subject">Subject</label>
          <input id="contact-subject" name="subject" type="text" autoComplete="off" required minLength={2} />
        </div>
        <div className="contact-field">
          <label htmlFor="contact-message">Message</label>
          <textarea id="contact-message" name="message" rows={6} required minLength={10} />
        </div>
        <div className="contact-submit-row">
          <button type="submit" className="project-button type-button" disabled={isSubmitting}>
            {isSubmitting ? "SENDING..." : "SEND MESSAGE"}
          </button>
          {status.message ? (
            <p className={`contact-form-status${status.isError ? " is-error" : ""}`} role="status" aria-live="polite">
              {status.message}
            </p>
          ) : null}
        </div>
      </form>
    </div>
  );
}
