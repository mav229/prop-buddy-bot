import { useEffect, useRef } from "react";
import { Link } from "react-router-dom";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { Button } from "@/components/ui/button";
import { MessageSquare, Brain, Zap, Shield, Globe, Clock, ArrowRight, ExternalLink } from "lucide-react";

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    icon: Brain,
    title: "AI-Powered Support",
    description: "Instant answers trained on your entire knowledge base. No wait times, no frustration.",
  },
  {
    icon: Zap,
    title: "Lightning Fast",
    description: "Sub-second responses powered by advanced language models. Your customers never wait.",
  },
  {
    icon: Shield,
    title: "Smart Escalation",
    description: "Seamlessly creates support tickets when human help is needed. Nothing falls through the cracks.",
  },
  {
    icon: Globe,
    title: "Embed Anywhere",
    description: "One script tag. That's all it takes to add Scholaris to any website.",
  },
  {
    icon: MessageSquare,
    title: "Multi-Platform",
    description: "Works on your website, Discord server, and anywhere your customers are.",
  },
  {
    icon: Clock,
    title: "24/7 Available",
    description: "Never sleeps, never takes a break. Always there for your customers.",
  },
];

const Landing = () => {
  const heroRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const navRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Nav fade in
      gsap.from(navRef.current, {
        y: -40, opacity: 0, duration: 0.8, ease: "power3.out",
      });

      // Hero animations
      const heroTl = gsap.timeline({ defaults: { ease: "power4.out" } });
      heroTl
        .from(".hero-badge", { y: 30, opacity: 0, duration: 0.6, delay: 0.3 })
        .from(".hero-title span", { y: 80, opacity: 0, duration: 1, stagger: 0.12 }, "-=0.3")
        .from(".hero-subtitle", { y: 30, opacity: 0, duration: 0.8 }, "-=0.5")
        .from(".hero-buttons", { y: 30, opacity: 0, duration: 0.6 }, "-=0.4")
        .from(".hero-glow", { scale: 0, opacity: 0, duration: 1.5, ease: "power2.out" }, "-=1");

      // Floating orbs
      gsap.to(".orb-1", { y: -20, x: 10, duration: 4, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".orb-2", { y: 15, x: -15, duration: 5, repeat: -1, yoyo: true, ease: "sine.inOut" });
      gsap.to(".orb-3", { y: -10, x: 20, duration: 3.5, repeat: -1, yoyo: true, ease: "sine.inOut" });

      // Features section title
      gsap.from(".features-label", {
        scrollTrigger: { trigger: featuresRef.current, start: "top 85%" },
        y: 30, opacity: 0, duration: 0.6, ease: "power3.out",
      });
      gsap.from(".features-title-main", {
        scrollTrigger: { trigger: featuresRef.current, start: "top 80%" },
        y: 60, opacity: 0, duration: 0.9, ease: "power3.out",
      });
      gsap.from(".features-title-sub", {
        scrollTrigger: { trigger: featuresRef.current, start: "top 78%" },
        y: 60, opacity: 0, duration: 0.9, delay: 0.15, ease: "power3.out",
      });

      // Pinned feature cards - stack on scroll like privatetraders.space
      const cards = document.querySelectorAll(".feature-card");
      cards.forEach((card, i) => {
        if (i < cards.length - 1) {
          ScrollTrigger.create({
            trigger: card,
            start: "top 15%",
            endTrigger: cards[cards.length - 1],
            end: "top 15%",
            pin: true,
            pinSpacing: false,
          });
        }
        // Fade + slide in each card
        gsap.from(card, {
          scrollTrigger: {
            trigger: card,
            start: "top bottom",
            end: "top 40%",
            scrub: 0.5,
          },
          y: 150,
          opacity: 0,
          scale: 0.92,
        });
      });

      // CTA section elements
      gsap.from(".cta-label", {
        scrollTrigger: { trigger: ctaRef.current, start: "top 80%" },
        y: 30, opacity: 0, duration: 0.6, ease: "power3.out",
      });
      gsap.from(".cta-title", {
        scrollTrigger: { trigger: ctaRef.current, start: "top 78%" },
        y: 50, opacity: 0, duration: 0.8, delay: 0.1, ease: "power3.out",
      });
      gsap.from(".cta-desc", {
        scrollTrigger: { trigger: ctaRef.current, start: "top 76%" },
        y: 40, opacity: 0, duration: 0.8, delay: 0.2, ease: "power3.out",
      });
      gsap.from(".cta-button", {
        scrollTrigger: { trigger: ctaRef.current, start: "top 74%" },
        y: 30, opacity: 0, duration: 0.6, delay: 0.35, ease: "power3.out",
      });

      // Footer
      gsap.from(".landing-footer", {
        scrollTrigger: { trigger: ".landing-footer", start: "top 95%" },
        y: 20, opacity: 0, duration: 0.6, ease: "power3.out",
      });
    });

    return () => ctx.revert();
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground overflow-hidden">
      {/* Nav */}
      <nav
        ref={navRef}
        className="fixed top-0 left-0 right-0 z-50 border-b border-border/30"
        style={{ background: "rgba(10,10,10,0.7)", backdropFilter: "blur(20px)" }}
      >
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <span className="font-semibold text-lg tracking-tight text-foreground">
            Scholaris<span className="text-muted-foreground font-light">.ai</span>
          </span>
          <div className="flex items-center gap-1">
            <Link to="/">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">Home</Button>
            </Link>
            <Link to="/chat">
              <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-foreground">Chat</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section ref={heroRef} className="relative min-h-screen flex items-center justify-center px-6 pt-16">
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="orb-1 absolute top-1/4 left-1/4 w-[400px] h-[400px] rounded-full bg-foreground/[0.03] blur-[100px]" />
          <div className="orb-2 absolute bottom-1/3 right-1/4 w-[300px] h-[300px] rounded-full bg-foreground/[0.04] blur-[80px]" />
          <div className="orb-3 absolute top-1/2 right-1/3 w-[200px] h-[200px] rounded-full bg-foreground/[0.02] blur-[60px]" />
        </div>
        <div className="hero-glow absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-foreground/[0.02] blur-[120px] pointer-events-none" />

        <div className="relative z-10 text-center max-w-4xl mx-auto">
          <div className="hero-badge inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 bg-card/30 backdrop-blur-sm mb-8">
            <div className="w-2 h-2 rounded-full bg-foreground animate-pulse" />
            <span className="text-xs text-muted-foreground tracking-widest uppercase">AI-Powered Customer Support</span>
          </div>

          <h1 className="hero-title font-semibold tracking-tight leading-[0.95] mb-8">
            <span className="block text-5xl sm:text-7xl md:text-8xl text-foreground">Your Support.</span>
            <span className="block text-5xl sm:text-7xl md:text-8xl text-foreground/40 mt-2">Reimagined.</span>
          </h1>

          <p className="hero-subtitle text-lg sm:text-xl text-muted-foreground max-w-xl mx-auto mb-10 font-light leading-relaxed">
            Scholaris is an AI assistant that knows your product inside out.
            Instant answers. Zero wait. Built by{" "}
            <a href="https://propscholar.com" target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline underline-offset-4 transition-colors">
              PropScholar
            </a>.
          </p>

          <div className="hero-buttons flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link to="/chat">
              <Button size="xl" variant="premium" className="group gap-3 text-base">
                Try Scholaris
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <a href="https://propscholar.com" target="_blank" rel="noopener noreferrer">
              <Button size="xl" variant="noir" className="gap-3 text-base">
                propscholar.com
                <ExternalLink className="w-4 h-4" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Features - Pinned stacked cards */}
      <section ref={featuresRef} className="relative pt-32 pb-16 px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-20">
            <p className="features-label text-xs tracking-[0.3em] uppercase text-muted-foreground mb-4">Features</p>
            <h2 className="text-3xl sm:text-5xl font-semibold tracking-tight">
              <span className="features-title-main text-foreground">Built for scale.</span>
              <span className="features-title-sub text-foreground/30"> Designed for humans.</span>
            </h2>
          </div>

          <div className="features-stack relative">
            {features.map((feature, i) => (
              <div
                key={feature.title}
                className="feature-card group rounded-2xl border border-border/30 bg-[hsl(0,0%,6%)] p-8 sm:p-10 hover:bg-card/50 transition-all duration-500 relative overflow-hidden mb-8"
              >
                <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-foreground/10 to-transparent" />
                <p className="text-xs text-muted-foreground/50 tracking-widest mb-6">
                  {String(i + 1).padStart(2, "0")} / {String(features.length).padStart(2, "0")}
                </p>
                <div className="flex items-start gap-5">
                  <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-foreground/5 border border-border/30 flex items-center justify-center group-hover:bg-foreground/10 transition-colors duration-500">
                    <feature.icon className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors duration-500" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-xl font-semibold text-foreground mb-2 tracking-tight">{feature.title}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed font-light max-w-lg">
                      {feature.description}
                    </p>
                  </div>
                </div>
                <div className="mt-8 pt-4 border-t border-border/20">
                  <p className="text-[10px] tracking-[0.25em] uppercase text-muted-foreground/40">Scholaris</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section ref={ctaRef} className="relative py-32 px-6">
        <div className="max-w-3xl mx-auto text-center">
          <div className="border border-border/30 rounded-3xl p-12 sm:p-16 bg-card/20 backdrop-blur-sm relative overflow-hidden">
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[300px] h-[1px] bg-gradient-to-r from-transparent via-foreground/20 to-transparent" />
            <p className="cta-label text-xs tracking-[0.3em] uppercase text-muted-foreground mb-6">For Businesses</p>
            <h2 className="cta-title text-3xl sm:text-4xl font-semibold tracking-tight text-foreground mb-4">
              Get Scholaris on your website
            </h2>
            <p className="cta-desc text-muted-foreground mb-10 font-light max-w-md mx-auto">
              Add an AI support agent that actually knows your product. One line of code, infinite support capacity.
            </p>
            <a href="mailto:support@propscholar.com?subject=Scholaris%20for%20my%20website" className="cta-button inline-block">
              <Button size="xl" variant="premium" className="group gap-3">
                Contact Us
                <ArrowRight className="w-4 h-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </a>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer border-t border-border/20 py-8 px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
          <span className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} Scholaris — Made by{" "}
            <a href="https://propscholar.com" target="_blank" rel="noopener noreferrer" className="text-foreground hover:underline">PropScholar</a>
          </span>
          <div className="flex items-center gap-6">
            <Link to="/chat" className="text-xs text-muted-foreground hover:text-foreground transition-colors">Chat</Link>
            <a href="https://propscholar.com" target="_blank" rel="noopener noreferrer" className="text-xs text-muted-foreground hover:text-foreground transition-colors">PropScholar</a>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Landing;
