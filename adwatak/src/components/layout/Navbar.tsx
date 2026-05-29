"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X } from "lucide-react";
import Container from "@/components/ui/Container";
import Button from "@/components/ui/Button";
import Logo from "./Logo";
import { NAV_LINKS } from "@/lib/constants";
import { useScrollPosition } from "@/hooks/useScrollPosition";
import { createClient } from "@/lib/supabase/client";

interface NavbarProps {
  initialEmail: string | null;
}

export default function Navbar({ initialEmail }: NavbarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [email, setEmail] = useState(initialEmail);
  const [isSigningOut, setIsSigningOut] = useState(false);
  const scrolled = useScrollPosition();

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data }) => {
      setEmail(data.user?.email ?? null);
    });
  }, []);

  const handleNavClick = (
    e: React.MouseEvent<HTMLAnchorElement>,
    href: string
  ) => {
    if (href.startsWith("#")) {
      e.preventDefault();
      const el = document.querySelector(href);
      if (el) {
        el.scrollIntoView({ behavior: "smooth" });
      }
      setIsOpen(false);
    }
  };

  return (
    <header
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        scrolled
          ? "bg-surface/80 backdrop-blur-xl border-b border-white/[0.06]"
          : "bg-transparent"
      }`}
    >
      <Container>
        <nav className="flex items-center justify-between h-16 md:h-20">
          <Logo />

          <ul className="hidden md:flex items-center gap-8">
            {NAV_LINKS.map((link) => (
              <li key={link.href}>
                <a
                  href={link.href}
                  onClick={(e) => handleNavClick(e, link.href)}
                  className="text-sm text-gray-400 hover:text-white transition-colors duration-300"
                >
                  {link.label}
                </a>
              </li>
            ))}
          </ul>

          <div className="hidden md:flex items-center gap-2">
            <Button href="#tools" size="sm">
              ابدأ الآن
            </Button>
            {!email ? (
              <Button href="/auth/login" variant="secondary" size="sm">
                تسجيل الدخول
              </Button>
            ) : (
              <>
                <span className="max-w-[180px] truncate text-xs text-gray-300" dir="ltr">
                  {email}
                </span>
                <Button href="/profile" variant="secondary" size="sm">
                  الملف الشخصي
                </Button>
                <button
                  type="button"
                  disabled={isSigningOut}
                  onClick={async () => {
                    if (isSigningOut) return;
                    setIsSigningOut(true);
                    await fetch("/api/auth/signout", { method: "POST" });
                    window.location.href = "/";
                  }}
                  className="rounded-xl px-4 py-2 text-sm text-red-300 hover:text-red-200 hover:bg-red-500/10 transition-colors disabled:opacity-60"
                >
                  تسجيل الخروج
                </button>
              </>
            )}
          </div>

          <button
            onClick={() => setIsOpen(!isOpen)}
            className="md:hidden p-2 text-gray-400 hover:text-white transition-colors"
            aria-label="القائمة"
          >
            {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </nav>
      </Container>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3 }}
            className="md:hidden border-t border-white/[0.06] bg-surface/95 backdrop-blur-xl"
          >
            <Container>
              <div className="py-6 flex flex-col gap-4">
                {NAV_LINKS.map((link) => (
                  <a
                    key={link.href}
                    href={link.href}
                    onClick={(e) => handleNavClick(e, link.href)}
                    className="text-base text-gray-400 hover:text-white transition-colors py-2"
                  >
                    {link.label}
                  </a>
                ))}
                <Button href="#tools" className="mt-2">ابدأ الآن</Button>
                {!email ? (
                  <Button href="/auth/login" variant="secondary">تسجيل الدخول</Button>
                ) : (
                  <>
                    <p className="text-xs text-gray-400" dir="ltr">{email}</p>
                    <Button href="/profile" variant="secondary">الملف الشخصي</Button>
                    <button
                      type="button"
                      disabled={isSigningOut}
                      onClick={async () => {
                        if (isSigningOut) return;
                        setIsSigningOut(true);
                        await fetch("/api/auth/signout", { method: "POST" });
                        window.location.href = "/";
                      }}
                      className="text-right rounded-xl px-4 py-3 text-sm text-red-300 hover:bg-red-500/10"
                    >
                      تسجيل الخروج
                    </button>
                  </>
                )}
              </div>
            </Container>
          </motion.div>
        )}
      </AnimatePresence>
    </header>
  );
}
