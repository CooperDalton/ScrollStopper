'use client';

import { useState, useEffect } from 'react';
import Image from "next/image";

// Icon Components
const PlayIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m6-10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2h14z" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const CheckIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
  </svg>
);

// Hero Section
const HeroSection = () => (
  <section className="relative overflow-hidden bg-[var(--color-bg)] pt-20 pb-16">
    {/* Animated background */}
    <div className="absolute inset-0 opacity-30">
      <div className="absolute top-1/4 left-1/4 w-72 h-72 bg-[var(--color-primary)] rounded-full filter blur-3xl animate-pulse-glow"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[var(--color-accent)] rounded-full filter blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }}></div>
    </div>
    
    <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center">
        <div className="flex justify-center mb-8">
          <div className="inline-flex items-center px-4 py-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-full text-sm text-[var(--color-text-muted)]">
            <SparklesIcon />
            <span className="ml-2">AI-Powered Content Generation</span>
          </div>
        </div>
        
        <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold tracking-tight mb-6">
          <span className="text-gradient">AI that thinks</span>
          <br />
          <span className="text-[var(--color-text)]">like a content strategist</span>
        </h1>
        
        <p className="text-xl md:text-2xl text-[var(--color-text-muted)] max-w-3xl mx-auto mb-12 leading-relaxed">
          Upload your product screenshots and let Cliploft generate scroll-stopping TikToks in seconds.
        </p>
        
        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <button className="bg-gradient-primary text-white px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 hover:scale-105 animate-glow">
            Start Free
          </button>
          <button className="flex items-center gap-2 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text)] px-8 py-4 rounded-xl font-semibold text-lg transition-all duration-300 hover:bg-[var(--color-bg-tertiary)]">
            <PlayIcon />
            Watch Demo
            <ArrowRightIcon />
          </button>
        </div>
      </div>
    </div>
  </section>
);

// How It Works Section
const HowItWorksSection = () => (
  <section className="py-20 bg-[var(--color-bg-secondary)]">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-bold text-[var(--color-text)] mb-6">
          How It Works
        </h2>
        <p className="text-xl text-[var(--color-text-muted)] max-w-2xl mx-auto">
          Three simple steps to transform your product into viral content
        </p>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8">
        {[
          {
            step: "01",
            title: "Describe your product",
            description: "Tell our AI about your product in plain English. No technical jargon needed.",
            icon: "📝"
          },
          {
            step: "02", 
            title: "Upload screenshots",
            description: "Drop in your product screenshots, mockups, or any visual assets.",
            icon: "📸"
          },
          {
            step: "03",
            title: "Let AI brainstorm and generate",
            description: "Watch as our AI creates multiple video formats optimized for engagement.",
            icon: "🤖"
          }
        ].map((item, index) => (
          <div key={index} className="relative group">
            <div className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-2xl p-8 h-full transition-all duration-300 hover:bg-[var(--color-bg)] hover:border-[var(--color-primary)] group-hover:scale-105">
              <div className="text-4xl mb-6">{item.icon}</div>
              <div className="text-sm font-mono text-[var(--color-primary)] mb-4">{item.step}</div>
              <h3 className="text-xl font-bold text-[var(--color-text)] mb-4">{item.title}</h3>
              <p className="text-[var(--color-text-muted)]">{item.description}</p>
            </div>
            
            {index < 2 && (
              <div className="hidden md:block absolute top-1/2 -right-4 w-8 h-8 text-[var(--color-primary)]">
                <ArrowRightIcon />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  </section>
);

// Live AI Brainstorm Preview Section
const AIBrainstormSection = () => {
  const [currentSlide, setCurrentSlide] = useState(0);
  
  const brainstormCards = [
    {
      status: "Thinking...",
      hook: "POV: You built the perfect productivity app",
      cta: "But nobody knows it exists 😭",
      format: "Problem/Solution Hook"
    },
    {
      status: "Generated",
      hook: "This app saves me 3 hours every day",
      cta: "Link in bio to try it free ⬆️",
      format: "Testimonial Style"
    },
    {
      status: "Optimizing...",
      hook: "Building in public: Day 47",
      cta: "Finally launched! What do you think?",
      format: "Behind-the-Scenes"
    },
    {
      status: "Generated",
      hook: "Productivity apps be like:",
      cta: "Try this one that actually works",
      format: "Trending Audio"
    }
  ];
  
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % brainstormCards.length);
    }, 3000);
    return () => clearInterval(timer);
  }, []);
  
  return (
    <section className="py-20 bg-[var(--color-bg)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-bold text-[var(--color-text)] mb-6">
            Watch AI <span className="text-gradient">Brainstorm</span> in Real-Time
          </h2>
          <p className="text-xl text-[var(--color-text-muted)] max-w-2xl mx-auto">
            See how our AI generates multiple video concepts for maximum viral potential
          </p>
        </div>
        
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {brainstormCards.map((card, index) => (
            <div 
              key={index} 
              className={`bg-[var(--color-bg-secondary)] border rounded-2xl p-6 transition-all duration-500 ${
                currentSlide === index 
                  ? 'border-[var(--color-primary)] bg-[var(--color-bg-tertiary)] scale-105' 
                  : 'border-[var(--color-border)]'
              }`}
            >
              <div className="flex items-center gap-2 mb-4">
                <div className={`w-2 h-2 rounded-full ${
                  card.status === 'Thinking...' ? 'bg-yellow-400 animate-pulse' :
                  card.status === 'Optimizing...' ? 'bg-blue-400 animate-pulse' :
                  'bg-green-400'
                }`}></div>
                <span className="text-sm text-[var(--color-text-muted)]">{card.status}</span>
              </div>
              
              <div className="bg-[var(--color-bg)] rounded-lg p-4 mb-4 border border-[var(--color-border)]">
                <div className="text-sm font-semibold text-[var(--color-text)] mb-2">{card.hook}</div>
                <div className="text-sm text-[var(--color-text-muted)]">{card.cta}</div>
              </div>
              
              <div className="text-xs text-[var(--color-primary)] font-medium">{card.format}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

// Testimonials Section
const TestimonialsSection = () => (
  <section className="py-20 bg-[var(--color-bg-secondary)]">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-bold text-[var(--color-text)] mb-6">
          Loved by Creators
        </h2>
      </div>
      
      <div className="grid md:grid-cols-3 gap-8">
        {[
          {
            quote: "Cliploft turned my boring SaaS screenshots into viral TikToks. 2M views in the first week!",
            author: "Sarah Chen",
            role: "Indie Hacker",
            avatar: "👩‍💻"
          },
          {
            quote: "The AI actually understands my product better than I do. It found angles I never thought of.",
            author: "Marcus Rodriguez",
            role: "Dropshipper",
            avatar: "👨‍💼"
          },
          {
            quote: "I was spending 5 hours per video. Now it's 5 minutes. This is insane.",
            author: "Alex Kim",
            role: "Content Creator",
            avatar: "🎬"
          }
        ].map((testimonial, index) => (
          <div key={index} className="bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] rounded-2xl p-8 transition-all duration-300 hover:border-[var(--color-primary)]">
            <div className="text-[var(--color-text)] mb-6 text-lg leading-relaxed">
              "{testimonial.quote}"
            </div>
            <div className="flex items-center gap-4">
              <div className="text-3xl">{testimonial.avatar}</div>
              <div>
                <div className="font-semibold text-[var(--color-text)]">{testimonial.author}</div>
                <div className="text-[var(--color-text-muted)]">{testimonial.role}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// Pricing Section
const PricingSection = () => (
  <section className="py-20 bg-[var(--color-bg)]">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <h2 className="text-3xl md:text-5xl font-bold text-[var(--color-text)] mb-6">
          Simple Pricing
        </h2>
        <p className="text-xl text-[var(--color-text-muted)]">
          Start free, upgrade when you're ready to scale
        </p>
      </div>
      
      <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
        {/* Free Plan */}
        <div className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] rounded-2xl p-8">
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-[var(--color-text)] mb-2">Free</h3>
            <div className="text-4xl font-bold text-[var(--color-text)] mb-2">$0</div>
            <div className="text-[var(--color-text-muted)]">Perfect for getting started</div>
          </div>
          
          <ul className="space-y-4 mb-8">
            {[
              "Manual video editor",
              "Basic templates",
              "720p exports",
              "Cliploft watermark"
            ].map((feature, index) => (
              <li key={index} className="flex items-center gap-3">
                <CheckIcon />
                <span className="text-[var(--color-text)]">{feature}</span>
              </li>
            ))}
          </ul>
          
          <button className="w-full bg-[var(--color-bg-tertiary)] border border-[var(--color-border)] text-[var(--color-text)] py-3 rounded-xl font-semibold transition-all duration-300 hover:bg-[var(--color-bg)]">
            Start Free
          </button>
        </div>
        
        {/* Pro Plan */}
        <div className="bg-gradient-primary border-2 border-[var(--color-primary)] rounded-2xl p-8 relative">
          <div className="absolute -top-4 left-1/2 transform -translate-x-1/2">
            <span className="bg-[var(--color-accent)] text-white px-4 py-1 rounded-full text-sm font-semibold">
              Most Popular
            </span>
          </div>
          
          <div className="text-center mb-8">
            <h3 className="text-2xl font-bold text-white mb-2">Pro</h3>
            <div className="text-4xl font-bold text-white mb-2">$40<span className="text-lg">/mo</span></div>
            <div className="text-white opacity-80">Everything you need to go viral</div>
          </div>
          
          <ul className="space-y-4 mb-8">
            {[
              "AI-powered video generation",
              "Unlimited exports",
              "4K video quality", 
              "No watermarks",
              "Priority support",
              "Advanced analytics"
            ].map((feature, index) => (
              <li key={index} className="flex items-center gap-3">
                <CheckIcon />
                <span className="text-white">{feature}</span>
              </li>
            ))}
          </ul>
          
          <button className="w-full bg-white text-[var(--color-primary)] py-3 rounded-xl font-semibold transition-all duration-300 hover:bg-gray-100">
            Start Pro Trial
          </button>
        </div>
      </div>
    </div>
  </section>
);

// Footer Section
const FooterSection = () => (
  <footer className="bg-[var(--color-bg-secondary)] border-t border-[var(--color-border)] py-12">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid md:grid-cols-4 gap-8">
        <div className="md:col-span-2">
          <div className="flex items-center gap-2 mb-4">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg"></div>
            <span className="text-xl font-bold text-[var(--color-text)]">Cliploft</span>
          </div>
          <p className="text-[var(--color-text-muted)] mb-6 max-w-md">
            AI-powered video generation for founders and marketers who want to create scroll-stopping content.
          </p>
          <div className="flex gap-4">
            {['Twitter', 'LinkedIn', 'YouTube'].map((social) => (
              <a 
                key={social}
                href="#" 
                className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors"
              >
                {social}
              </a>
            ))}
          </div>
        </div>
        
        <div>
          <h4 className="font-semibold text-[var(--color-text)] mb-4">Product</h4>
          <ul className="space-y-2">
            {['Features', 'Pricing', 'Templates', 'API'].map((link) => (
              <li key={link}>
                <a href="#" className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors">
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </div>
        
        <div>
          <h4 className="font-semibold text-[var(--color-text)] mb-4">Company</h4>
          <ul className="space-y-2">
            {['About', 'Blog', 'Support', 'Privacy'].map((link) => (
              <li key={link}>
                <a href="#" className="text-[var(--color-text-muted)] hover:text-[var(--color-primary)] transition-colors">
                  {link}
                </a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      
      <div className="border-t border-[var(--color-border)] mt-12 pt-8 text-center">
        <p className="text-[var(--color-text-muted)]">
          © 2024 Cliploft. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
);

// Main Page Component
export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <HeroSection />
      <HowItWorksSection />
      <AIBrainstormSection />
      <TestimonialsSection />
      <PricingSection />
      <FooterSection />
    </div>
  );
}
