import { ImageResponse } from 'next/og';

export const runtime = 'edge';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const title = searchParams.get('title') || 'FactSport Briefing';
    const logosParam = searchParams.get('logos');
    const type = searchParams.get('type') || 'preview';
    
    // Parse up to 4 logos from the URL
    const logos = logosParam ? logosParam.split(',').filter(Boolean).slice(0, 4) : [];

    // Choose the atmospheric background based on whether it's a preview or a summary
    const bgImage = type === 'summary' 
        ? 'https://images.unsplash.com/photo-1556056504-5c7696c4c28d?q=80&w=1200&auto=format&fit=crop' 
        : 'https://images.unsplash.com/photo-1614632537190-23e4146777db?q=80&w=1200&auto=format&fit=crop';

    return new ImageResponse(
      (
        <div
          style={{
            height: '100%',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundImage: `url(${bgImage})`,
            backgroundSize: '100% 100%',
            fontFamily: 'sans-serif',
          }}
        >
          {/* Dark Overlay for perfect text readability */}
          <div style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(15, 20, 30, 0.85)' }} />

          {/* Content Container */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', zIndex: 10 }}>
            
            <div style={{ fontSize: 28, color: '#ef4444', marginBottom: 15, fontWeight: 800, letterSpacing: '2px' }}>
              {type === 'summary' ? 'MATCHDAY ROUND-UP' : "TODAY'S BIGGEST FIXTURES"}
            </div>

            {/* The Headline */}
            <div style={{ fontSize: 72, fontWeight: 900, color: 'white', textTransform: 'uppercase', letterSpacing: '-2px', textAlign: 'center', padding: '0 40px' }}>
              {title}
            </div>

            {/* The Logo Collage Grid */}
            <div style={{ display: 'flex', gap: '30px', marginTop: '60px' }}>
              {logos.map((logo, i) => (
                <div key={i} style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  width: 140, 
                  height: 140, 
                  backgroundColor: 'rgba(255,255,255,0.05)', 
                  borderRadius: '24px', 
                  padding: '20px', 
                  border: '2px solid rgba(255,255,255,0.1)',
                  boxShadow: '0 20px 40px rgba(0,0,0,0.5)'
                }}>
                  <img src={logo} style={{ width: '100%', height: '100%', objectFit: 'contain' }} />
                </div>
              ))}
            </div>

            {/* Branding Tag */}
            <div style={{ position: 'absolute', bottom: 40, display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div style={{ width: 14, height: 14, backgroundColor: '#ef4444', borderRadius: '50%' }} />
              <span style={{ fontSize: 24, color: 'white', fontWeight: 'bold', letterSpacing: '4px' }}>FACTSPORT</span>
            </div>
          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
      }
    );
  } catch (e: any) {
    return new Response(`Failed to generate image`, { status: 500 });
  }
}