import Container from "@/components/ui/Container";
import Logo from "./Logo";
import { SITE } from "@/lib/constants";
import { tools } from "@/lib/tools";
import Link from "next/link";
import { Github, Twitter, Mail } from "lucide-react";

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] bg-surface/50">
      <Container className="py-12 md:py-16">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
          <div className="sm:col-span-2 lg:col-span-1">
            <Logo />
            <p className="mt-4 text-sm text-gray-500 leading-relaxed max-w-xs">
              {SITE.description}
            </p>
            <div className="mt-6 flex items-center gap-4">
              <a
                href="#"
                className="text-gray-500 hover:text-gray-300 transition-colors"
                aria-label="Github"
              >
                <Github className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="text-gray-500 hover:text-gray-300 transition-colors"
                aria-label="Twitter"
              >
                <Twitter className="h-5 w-5" />
              </a>
              <a
                href="#"
                className="text-gray-500 hover:text-gray-300 transition-colors"
                aria-label="Email"
              >
                <Mail className="h-5 w-5" />
              </a>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">روابط سريعة</h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="#hero"
                  className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                >
                  الرئيسية
                </a>
              </li>
              <li>
                <a
                  href="#tools"
                  className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                >
                  الأدوات
                </a>
              </li>
              <li>
                <a
                  href="#features"
                  className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                >
                  المميزات
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">الأدوات</h4>
            <ul className="space-y-3">
              {tools.map((tool) => (
                <li key={tool.slug}>
                  <Link
                    href={`/tools/${tool.slug}`}
                    className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                  >
                    {tool.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-sm font-semibold text-white mb-4">الدعم</h4>
            <ul className="space-y-3">
              <li>
                <a
                  href="#"
                  className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                >
                  سياسة الخصوصية
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                >
                  شروط الاستخدام
                </a>
              </li>
              <li>
                <a
                  href="#"
                  className="text-sm text-gray-500 hover:text-gray-300 transition-colors"
                >
                  اتصل بنا
                </a>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-white/[0.06] text-center">
          <p className="text-sm text-gray-600">
            © {new Date().getFullYear()} {SITE.name}. جميع الحقوق محفوظة.
          </p>
        </div>
      </Container>
    </footer>
  );
}
