'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { subscriptionTiers } from '@/data/subscriptionTiers';
import GetStartedButton from '@/components/GetStartedButton';

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

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId);
    if (element) {
      const headerOffset = 80; // Account for fixed header
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
    setIsMenuOpen(false); // Close mobile menu after clicking
  };

  return (
    <header className="bg-white/80 backdrop-blur-md border-b border-[var(--color-border)] fixed top-0 left-0 right-0 z-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center py-4">
          {/* Logo */}
          <Link href="/" className="flex items-center space-x-2">
            <img
              src="/Logos/LogoWBackground.png"
              alt="ScrollStopper Logo"
              className="w-8 h-8 object-contain rounded-lg"
            />
            <span className="text-xl font-bold text-[var(--color-text)]">ScrollStopper</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center space-x-8">
            <button 
              onClick={() => scrollToSection('home')} 
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              Home
            </button>
            <button 
              onClick={() => scrollToSection('features')} 
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              Features
            </button>
            <button 
              onClick={() => scrollToSection('pricing')} 
              className="text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
            >
              Pricing
            </button>
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
                <GetStartedButton className="btn-gradient" />
              </>
            ) : (
              <>
                <button onClick={handleSignIn} className="btn-outline">
                  Sign In
                </button>
                <GetStartedButton className="btn-gradient" />
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
              <button 
                onClick={() => scrollToSection('home')} 
                className="text-left text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                Home
              </button>
              <button 
                onClick={() => scrollToSection('features')} 
                className="text-left text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                Features
              </button>
              <button 
                onClick={() => scrollToSection('pricing')} 
                className="text-left text-[var(--color-text-muted)] hover:text-[var(--color-text)] transition-colors"
              >
                Pricing
              </button>
              <div className="flex flex-col space-y-2 pt-4">
                {loading ? (
                  <div className="w-8 h-8 animate-spin rounded-full border-2 border-[var(--color-primary)] border-t-transparent mx-auto"></div>
                ) : user ? (
                  <>
                    <button onClick={handleSignOut} className="btn-outline">
                      Log Out
                    </button>
                    <GetStartedButton className="btn-gradient" />
                  </>
                ) : (
                  <>
                    <button onClick={handleSignIn} className="btn-outline">
                      Sign In
                    </button>
                    <GetStartedButton className="btn-gradient" />
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

                     {/* Main Headline */}
           <div className="space-y-6">
             <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold leading-tight">
               <span className="text-gradient">AI Slop</span>{" "}
               <span className="text-[var(--color-text)]">that makes you money</span>
             </h1>
             
             <div className="space-y-4">
               <p className="text-xl text-[var(--color-text-muted)] max-w-lg leading-relaxed">
                 Spend less time marketing and more time building.
               </p>
             </div>
           </div>

          {/* CTA Button */}
          <div className="flex items-center space-x-4">
            <Link href="/ai-editor" className="btn-gradient text-lg px-8 py-4 flex items-center space-x-2 animate-glow">
              <span>TRY NOW</span>
              <SparklesIcon />
            </Link>
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

const CopyContent = () => {
  // Shared styles for consistency
  const sectionClass = "py-24 px-4 border-b border-[var(--color-border)] last:border-0";
  const containerClass = "max-w-3xl mx-auto text-center space-y-12";
  const headingClass = "text-3xl md:text-5xl font-bold leading-tight text-[var(--color-text)]";
  const subHeadingClass = "text-xl md:text-2xl text-[var(--color-text-muted)] leading-relaxed";
  
  return (
    <div className="bg-[var(--color-bg)]">
      {/* THE PROBLEM */}
      <section className={sectionClass}>
        <div className={containerClass}>
          <h2 className={headingClass}>
            I built this because<br/>
            <span className="text-[var(--color-text-muted)] opacity-60">“just post on TikTok every day”</span><br/>
            is terrible advice if you’re a founder.
          </h2>
          
          <div className="space-y-6">
            <p className="text-lg font-medium text-[var(--color-primary)] uppercase tracking-wider">You’re already:</p>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-lg font-semibold text-[var(--color-text)]">
              <div className="p-4 rounded-2xl bg-[var(--color-bg-secondary)]">building</div>
              <div className="p-4 rounded-2xl bg-[var(--color-bg-secondary)]">fixing bugs</div>
              <div className="p-4 rounded-2xl bg-[var(--color-bg-secondary)]">talking to users</div>
              <div className="p-4 rounded-2xl bg-[var(--color-bg-secondary)]">trying not to burn out</div>
            </div>
          </div>

          <p className="text-2xl font-bold text-[var(--color-text)] pt-4">
            Marketing shouldn’t be another full-time job.
          </p>
        </div>
      </section>

      {/* THE PROMISE + HOW IT WORKS */}
      <section className={`${sectionClass} bg-[var(--color-bg-secondary)]`}>
        <div className={containerClass}>
          <div className="space-y-4">
            <p className={headingClass}>
              So this does one thing:
            </p>
          </div>
          <p className={subHeadingClass}>
            It turns your product into daily short-form content<br className="hidden md:block"/>
            without you thinking about it.
          </p>

          <div className="grid gap-8 md:grid-cols-3 text-left pt-12">
            {[
              { step: "01", text: "Upload screenshots." },
              { step: "02", text: "Describe your product once." },
              { step: "03", text: "AI generates content designed to get views." }
            ].map((item, i) => (
              <div key={i} className="p-8 rounded-3xl bg-[var(--color-bg)] hover:scale-105 transition-transform duration-300 shadow-sm">
                <div className="text-5xl font-bold text-[var(--color-primary)]/20 mb-4">{item.step}</div>
                <p className="text-xl font-bold text-[var(--color-text)]">{item.text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* THE TONE CHECK */}
      <section className="py-24 px-4 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] relative overflow-hidden">
        <div className="max-w-4xl mx-auto relative z-10">
          <div className="text-center mb-12">
            <span className="inline-block px-4 py-1.5 rounded-full border border-purple-200 bg-white text-sm font-medium text-purple-600 shadow-sm">
              The Vibe Check
            </span>
          </div>
          
          <div className="grid md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-purple-100 border border-purple-100 rounded-2xl bg-white shadow-xl shadow-purple-900/5">
            <div className="p-8 text-center">
              <p className="text-gray-500 mb-3 text-sm uppercase tracking-wide font-medium">Is it art?</p>
              <p className="text-4xl font-bold text-gray-900">No.</p>
            </div>
            
            <div className="p-8 text-center relative overflow-hidden group">
              <div className="absolute inset-0 bg-purple-50 opacity-0 group-hover:opacity-100 transition-opacity" />
              <p className="text-purple-600/70 mb-3 text-sm uppercase tracking-wide font-medium relative z-10">Is it vibe marketing?</p>
              <p className="text-4xl font-bold text-purple-600 relative z-10">Absolutely.</p>
            </div>

            <div className="p-8 text-center">
              <p className="text-gray-500 mb-3 text-sm uppercase tracking-wide font-medium">Does the algorithm care?</p>
              <p className="text-4xl font-bold text-gray-900">Also no.</p>
            </div>
          </div>
        </div>
      </section>

      {/* WHY THIS MATTERS */}
      <section className={sectionClass}>
        <div className={containerClass}>
          <h2 className={headingClass}>
            Most founders don’t lose because their product is bad.
          </h2>
          <p className={subHeadingClass}>
            They lose because nobody sees it.
          </p>
          <div className="pt-8 flex flex-col md:flex-row justify-center gap-8 text-2xl font-bold">
            <div className="flex items-center justify-center space-x-2 text-green-500 bg-green-500/10 px-6 py-3 rounded-full">
              <span>Attention compounds</span>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" /></svg>
            </div>
            <div className="flex items-center justify-center space-x-2 text-red-500 bg-red-500/10 px-6 py-3 rounded-full">
              <span>Silence doesn’t</span>
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 17h8m0 0V9m0 8l-8-8-4 4-6-6" /></svg>
            </div>
          </div>
        </div>
      </section>

      {/* THE REAL PROBLEM THIS SOLVES */}
      <section className={`${sectionClass} bg-[var(--color-bg-secondary)]`}>
        <div className={containerClass}>
          <p className="text-xl text-[var(--color-text-muted)]">This tool exists to solve exactly one problem:</p>
          <h2 className="text-4xl md:text-6xl font-black text-[var(--color-text)] italic tracking-tight">
            “I want eyeballs on my product.”
          </h2>
          <p className="text-xl font-bold text-[var(--color-text)]">That’s it.</p>
        </div>
      </section>

      {/* WHO THIS IS FOR */}
      <section className={sectionClass}>
        <div className={containerClass}>
          <h2 className={headingClass}>Who is this for?</h2>
          
          <div className="flex flex-col items-center space-y-6">
            <p className="text-xl text-[var(--color-text-muted)]">If you...</p>
            <div className="space-y-6 w-full max-w-lg text-left">
              {[
                "keep telling yourself “I’ll market after this next feature”",
                "hate how much content seems to matter now",
                "just want your product to get seen"
              ].map((item, i) => (
                <div key={i} className="flex items-start space-x-4">
                  <div className="flex-shrink-0 mt-1 w-6 h-6 rounded-full bg-[var(--color-primary)]/10 flex items-center justify-center text-[var(--color-primary)]">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                  </div>
                  <span className="text-lg font-medium text-[var(--color-text)] leading-relaxed">{item}</span>
                </div>
              ))}
            </div>
            <p className="pt-8 text-xl text-[var(--color-text-muted)]">You’ll probably like this.</p>
          </div>
        </div>
      </section>
    </div>
  );
};

// Features Section
const FeaturesSection = () => (
  <section id="features" className="py-20 bg-white">
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-16">
        <h2 className="text-4xl md:text-5xl font-bold text-[var(--color-text)] mb-6">
          Everything you need to create <span className="text-gradient">viral content</span>
        </h2>
        <p className="text-xl text-[var(--color-text-muted)] max-w-2xl mx-auto">
          Stop overthinking it. Give the algorithm what it wants so you can get back to building.
        </p>
      </div>

      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
        {[
          {
            icon: "🎬",
            title: "Slideshow Creator",
            description: "Build stunning slideshows with our intuitive drag-and-drop editor. Perfect for showcasing your products and ideas.",
            status: "available"
          },
          {
            icon: "🤖",
            title: "AI Slideshow Creator", 
            description: "Let AI do the work! Generate compelling slideshows automatically from your screenshots and product images.",
            status: "available"
          },
          {
            icon: "📸",
            title: "1080p Image Export",
            description: "Export your creations in crisp 1080p resolution, ready for any platform or marketing campaign.",
            status: "available"
          },
          {
            icon: "🖼️",
            title: "Image Library",
            description: "Access our curated library of high-quality images to enhance your slideshows and content.",
            status: "available"
          },
          {
            icon: "📱",
            title: "TikTok Scheduler",
            description: "Plan and schedule your Tik Tok posts seamlessly from one dashboard.",
            status: "coming-soon"
          },
          {
            icon: "📷",
            title: "Instagram Scheduler",
            description: "Plan and schedule your Instagram posts seamlessly from one dashboard.",
            status: "coming-soon"
          }
        ].map((feature, index) => (
          <div key={index} className="relative text-center p-8 rounded-3xl bg-gradient-light hover:shadow-lg transition-all duration-300 group">
            {feature.status === "coming-soon" && (
              <div className="absolute top-4 right-4 bg-gradient-primary text-white text-xs font-semibold px-3 py-1 rounded-full">
                Coming Soon
              </div>
            )}
            <div className="text-4xl mb-4 group-hover:scale-110 transition-transform duration-300">{feature.icon}</div>
            <h3 className="text-xl font-bold text-[var(--color-text)] mb-4">{feature.title}</h3>
            <p className={`${feature.status === "coming-soon" ? "text-[var(--color-text-muted)]/70" : "text-[var(--color-text-muted)]"}`}>
              {feature.description}
            </p>
          </div>
        ))}
      </div>
    
    </div>
  </section>
);

// Pricing Section
const PricingSection = () => (
  <section id="pricing" className="py-20 bg-gradient-to-br from-gray-50 to-white">
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
      <div className="text-center mb-12">
        <h2 className="text-4xl md:text-5xl font-bold text-[var(--color-text)] mb-6">
          Pricing
      </h2>
      </div>

      {/* Pricing Card */}
      <div className="max-w-md mx-auto">
        <div className="bg-white rounded-3xl shadow-xl border-2 border-purple-500 overflow-hidden relative">
          <div className="p-8">
            {/* Price */}
            <div className="text-center mb-8">
              <div className="flex items-center justify-center mb-2">
                <span className="text-5xl font-bold text-[var(--color-text)]">${subscriptionTiers.Pro.priceInCents / 100}</span>
                <span className="text-xl text-[var(--color-text-muted)] ml-2">/month</span>
              </div>
              <div className="bg-gradient-primary text-white px-4 py-2 rounded-full text-sm font-semibold inline-block">
                🚀 Early Bird Pricing! Will increase soon
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
                  <p className="text-[var(--color-text)] font-medium">Easy Slideshow Creator
                  </p>
                  <p className="text-sm text-[var(--color-text-muted)]">Up to {subscriptionTiers.Pro.maxNumberOfSlideshows} slideshows/month</p>
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
                  <p className="text-sm text-[var(--color-text-muted)]">Up to {subscriptionTiers.Pro.maxNumberOfAIGenerations} AI generations/month</p>
                </div>
              </div>


              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 rounded-full bg-green-500 flex-shrink-0 flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-[var(--color-text)] font-medium">Photo Library</p>
                  <p className="text-sm text-[var(--color-text-muted)]">250+ Images to get you started</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-5 h-5 rounded-full bg-green-500 flex-shrink-0 flex items-center justify-center mt-0.5">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
                <div>
                  <p className="text-[var(--color-text)] font-medium">HD Image Export</p>
                  <p className="text-sm text-[var(--color-text-muted)]">1080p image downloads</p>
                </div>
              </div>
            </div>

            {/* CTA Button */}
            <GetStartedButton className="w-full bg-gradient-primary text-white px-8 py-4 rounded-xl font-semibold text-lg hover:shadow-lg transition-all duration-300 animate-glow">
              Get Started Now
            </GetStartedButton>
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
            <img
              src="/Logos/LogoWBackground.png"
              alt="ScrollStopper Logo"
              className="w-8 h-8 object-contain rounded-lg"
            />
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
      <CopyContent />
      <FeaturesSection />
      <PricingSection />
    </div>
  );
}
