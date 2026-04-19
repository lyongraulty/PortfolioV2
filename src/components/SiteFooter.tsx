import { Container } from "@/components/Container";

export function SiteFooter() {
  return (
    <footer id="contact" className="site-footer">
      <Container className="site-footer-inner">
        <nav aria-label="Social links">
          <ul className="site-footer-links">
            <li>
              <a href="https://www.instagram.com" target="_blank" rel="noreferrer">
                Instagram
              </a>
            </li>
            <li>
              <a href="https://www.behance.net" target="_blank" rel="noreferrer">
                Behance
              </a>
            </li>
            <li>
              <a href="https://www.linkedin.com" target="_blank" rel="noreferrer">
                LinkedIn
              </a>
            </li>
          </ul>
        </nav>
        <p>
          <a href="mailto:hello@lyongraulty.com">hello@lyongraulty.com</a>
        </p>
        <p>© {new Date().getFullYear()} Portfolio</p>
      </Container>
    </footer>
  );
}
