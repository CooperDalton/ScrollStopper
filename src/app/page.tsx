'use client';

import { useState } from 'react';
import Image from "next/image";
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';

// Icon Components
const MenuIcon = () => (
  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
  </svg>
);

const ArrowRightIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 8l4 4m0 0l-4 4m4-4H3" />
  </svg>
);

const SparklesIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z" />
  </svg>
);

const PlayIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h1m4 0h1m-6 4h1m4 0h1m6-10a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2h14z" />
  </svg>
);

const UserIcon = () => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
  </svg>
);

const ChevronDownIcon = () => (
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
);

// Header Component
const Header = () => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const { user, loading, signInWithGoogle, signOut } = useAuth();

  const handleSignIn = async () => {
    const result = await signInWithGoogle();
    if (result.error) {
      console.error('Failed to sign in:', result.error);
      // You could show a toast notification here
    }
  };

  const handleSignOut = async () => {
    const result = await signOut();
    if (result.error) {
      console.error('Failed to sign out:', result.error);
    }
  };

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-[var(--color-border)] fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <SparklesIcon />
            </div>
            <span className="text-xl font-bold text-[var(--color-text)]">ScrollStopper</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <Link href="#" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
              Home
            </Link>
            <Link href="#" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
              Features
            </Link>
            <Link href="#" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
              Pricing
            </Link>
            <Link href="#" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
              About
            </Link>
          </nav>

          {/* Auth Section */}
          <div className="hidden md:flex items-center space-x-4">
            {loading ? (
              <div className="w-8 h-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent"></div>
            ) : user ? (
              <>
                <button onClick={handleSignOut} className="btn-outline">
                  Log Out
                </button>
                <Link href="/editor" className="btn-gradient">
                  Get Started
                </Link>
              </>
            ) : (
              <>
                <button onClick={handleSignIn} className="btn-outline">
                  Sign In
                </button>
                <Link href="/editor" className="btn-gradient">
                  Get Started
                </Link>
              </>
            )}
          </div>

          {/* Mobile Menu Button */}
          <button 
            className="md:hidden"
            onClick={() => setIsMenuOpen(!isMenuOpen)}
          >
            <MenuIcon />
          </button>
        </div>

        {/* Mobile Menu */}
        {isMenuOpen && (
          <div className="md:hidden pb-4 border-t border-[var(--color-border)] mt-4">
            <nav className="flex flex-col space-y-4 pt-4">
              <Link href="#" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
                Home
              </Link>
              <Link href="#" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
                Features
              </Link>
              <Link href="#" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
                Pricing
              </Link>
              <Link href="#" className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors">
                About
              </Link>
              <div className="flex flex-col space-y-2 pt-4">
                {loading ? (
                  <div className="w-8 h-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent mx-auto"></div>
                ) : user ? (
                  <>
                    <button onClick={handleSignOut} className="btn-outline">
                      Log Out
                    </button>
                    <Link href="/editor" className="btn-gradient">
                      Get Started
                    </Link>
                  </>
                ) : (
                  <>
                    <button onClick={handleSignIn} className="btn-outline">
                      Sign In
                    </button>
                    <Link href="/editor" className="btn-gradient">
                      Get Started
                    </Link>
                  </>
                )}
              </div>
            </nav>
          </div>
        )}
      </div>
    </header>
  );
};

// Hero Section with Two-Column Layout
const HeroSection = () => (
  <section className="pt-32 pb-20 bg-gradient-to-br from-[var(--color-bg)] via-[var(--color-bg-secondary)] to-[var(--color-bg-tertiary)] min-h-screen flex items-center">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid lg:grid-cols-2 gap-12 items-center">
        {/* Left Column - Text Content */}
        <div className="space-y-8">
          {/* Badge */}
          <div className="inline-flex items-center px-4 py-2 bg-gradient-light rounded-full border border-[var(--color-primary)]/20">
            <SparklesIcon />
            <span className="ml-2 text-sm font-medium text-[var(--color-primary)]">
              Next-Gen AI Automation
            </span>
          </div>

                     {/* Main Headline */}
           <div className="space-y-6">
             <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
               <span className="text-gradient">AI-powered content</span>{" "}
               <span className="text-[var(--color-text)]">that thinks like a</span>
               <br />
               <span className="text-[var(--color-text)]">content strategist</span>
             </h1>
             
             <div className="space-y-4">
               <p className="text-xl text-[var(--color-text-muted)] max-w-lg leading-relaxed">
                 Transform your product screenshots into scroll-stopping videos with AI that understands viral content.
               </p>
             </div>
           </div>

          {/* CTA Button */}
          <div className="flex items-center space-x-4">
            <button className="btn-gradient text-lg px-8 py-4 flex items-center space-x-2 animate-glow">
              <span>TRY NOW</span>
              <SparklesIcon />
            </button>
            <button className="btn-outline text-lg px-8 py-4 flex items-center space-x-2">
              <PlayIcon />
              <span>Watch Demo</span>
            </button>
          </div>
        </div>

        {/* Right Column - Visual Element */}
        <div className="relative">
          <div className="relative w-full h-96 lg:h-[500px] bg-gradient-primary rounded-4xl overflow-hidden animate-gradient">
            {/* Placeholder for future video/gif */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-4 animate-pulse">
                  <PlayIcon />
                </div>
                <p className="text-lg font-medium opacity-90">
                  Video Coming Soon
                </p>
                <p className="text-sm opacity-75">
                  AI-powered content generation in action
                </p>
              </div>
            </div>
            
            {/* Decorative elements */}
            <div className="absolute top-8 left-8 w-12 h-12 bg-white/20 rounded-full animate-float"></div>
            <div className="absolute bottom-8 right-8 w-8 h-8 bg-white/30 rounded-full animate-float" style={{animationDelay: '2s'}}></div>
            <div className="absolute top-1/2 right-16 w-6 h-6 bg-white/25 rounded-full animate-float" style={{animationDelay: '4s'}}></div>
          </div>
          
          {/* Floating elements around the main visual */}
          <div className="absolute -top-4 -right-4 w-16 h-16 bg-white glass-card rounded-2xl flex items-center justify-center animate-float">
            <SparklesIcon />
          </div>
          <div className="absolute -bottom-4 -left-4 w-14 h-14 bg-white glass-card rounded-2xl flex items-center justify-center animate-float" style={{animationDelay: '1s'}}>
            <ArrowRightIcon />
          </div>
        </div>
      </div>
    </div>
  </section>
);

// Features Section
const FeaturesSection = () => (
  <section className="py-20 bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-bold text-[var(--color-text)] mb-6">
          Powered by <span className="text-gradient">Advanced AI</span>
        </h2>
        <p className="text-xl text-[var(--color-text-muted)] max-w-2xl mx-auto">
          Make data-driven decisions with AI insights that transform your content strategy.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        {[
          {
            icon: "🤖",
            title: "AI Content Analysis",
            description: "Advanced algorithms analyze your screenshots and generate optimized content strategies."
          },
          {
            icon: "⚡",
            title: "Instant Generation",
            description: "Create scroll-stopping content in seconds, not hours. Efficiency redefined."
          },
          {
            icon: "🎯",
            title: "Precision Targeting",
            description: "AI identifies the best content angles for maximum engagement and conversions."
          }
        ].map((feature, index) => (
          <div key={index} className="text-center p-8 rounded-3xl bg-gradient-light hover:shadow-lg transition-all duration-300">
            <div className="text-4xl mb-4">{feature.icon}</div>
            <h3 className="text-xl font-bold text-[var(--color-text)] mb-4">{feature.title}</h3>
            <p className="text-[var(--color-text-muted)]">{feature.description}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

// Pricing Section
const PricingSection = () => (
  <section className="py-20 bg-gradient-to-br from-gray-50 to-white">
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h2 className="text-4xl md:text-5xl font-bold text-[var(--color-text)] mb-6">
          Pricing
      </h2>
      </div>

      {/* Pricing Card */}
      <div className="max-w-lg mx-auto">
        <div className="bg-white rounded-3xl shadow-xl border-2 border-purple-500 overflow-hidden relative">
          <div className="p-8">
            {/* Price */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-2">
                <span className="text-5xl font-bold text-[var(--color-text)]">$9.99</span>
                <span className="text-xl text-[var(--color-text-muted)] ml-2">/month</span>
              </div>
              <div className="bg-gradient-primary text-white px-4 py-2 rounded-full text-sm font-semibold inline-block">
                🚀 Beta Pricing! Will increase soon
              </div>
            </div>

            {/* Features List */}
            <div className="space-y-4 mb-8">
              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 rounded-full bg-green-500 flex-shrink-0 flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-[var(--color-text)] font-medium">AI-Powered Content Generation</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Content Creation in a single click</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 rounded-full bg-green-500 flex-shrink-0 flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-[var(--color-text)] font-medium">Manual Slideshow Creation</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Up to 50 slideshows/month <span className="text-orange-600 font-medium">($0.25 each additional)</span></p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 rounded-full bg-green-500 flex-shrink-0 flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-[var(--color-text)] font-medium">AI-Generated Slideshows</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Up to 15 AI generations/month <span className="text-orange-600 font-medium">($1.99 each additional)</span></p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 rounded-full bg-green-500 flex-shrink-0 flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-[var(--color-text)] font-medium">HD Video Export</p>
                  <p className="text-sm text-[var(--color-text-muted)]">1080p & 4K video downloads</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 rounded-full bg-green-500 flex-shrink-0 flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-[var(--color-text)] font-medium">Priority Support</p>
                  <p className="text-sm text-[var(--color-text-muted)]">Email & chat support</p>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <button className="w-full bg-gradient-primary text-white px-8 py-4 rounded-xl font-semibold text-lg hover:shadow-lg transition-all duration-300 animate-glow">
              Get Started Now
        </button>
          </div>
        </div>
      </div>
    </div>
  </section>
);

// Footer
const Footer = () => (
  <footer className="bg-[var(--color-bg-secondary)] py-12 border-t border-[var(--color-border)]">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="grid md:grid-cols-4 gap-8">
        <div className="md:col-span-2">
          <div className="flex items-center space-x-2 mb-4">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <SparklesIcon />
            </div>
            <span className="text-xl font-bold text-[var(--color-text)]">ScrollStopper</span>
          </div>
          <p className="text-[var(--color-text-muted)] mb-6 max-w-md">
            AI-powered content generation that transforms screenshots into scroll-stopping videos.
          </p>
        </div>
        
        <div>
          <h4 className="font-semibold text-[var(--color-text)] mb-4">Product</h4>
          <ul className="space-y-2">
            {['Features', 'Pricing', 'API', 'Templates'].map((link) => (
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
            {['About', 'Blog', 'Careers', 'Contact'].map((link) => (
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
          © 2024 ScrollStopper. All rights reserved.
        </p>
      </div>
    </div>
  </footer>
);

// Main Page Component
export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--color-bg)]">
      <Header />
      <HeroSection />
      <FeaturesSection />
      <PricingSection />
      <Footer />
    </div>
  );
}
