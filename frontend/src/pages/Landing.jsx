import { Link } from 'react-router-dom'
import { Icon } from '../components/Icons'

const steps = [
  {
    icon: 'wand',
    number: '01',
    title: 'Name what you’re learning',
    copy: 'Drop in a topic, chapter, or study goal. CardSparks turns it into a focused first draft.',
  },
  {
    icon: 'edit',
    number: '02',
    title: 'Make every card yours',
    copy: 'Review, rewrite, add, or remove anything before it joins your deck. You always have the final word.',
  },
  {
    icon: 'trophy',
    number: '03',
    title: 'Remember it for longer',
    copy: 'Study with smart intervals, honest ratings, and progress that shows what needs your attention next.',
  },
]

export default function Landing() {
  return (
    <div className="landing-page">
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <span className="landing-badge"><Icon name="sparkles" size={14} /> AI-powered flashcards, minus the busywork</span>
          <h1>Turn any topic into something <em>you remember.</em></h1>
          <p>CardSparks builds a thoughtful flashcard deck from your study goal, then helps you practice at exactly the right time.</p>
          <div className="landing-hero-actions">
            <Link className="button button-primary landing-primary-cta" to="/signup">Start learning free <Icon name="arrowRight" size={17} /></Link>
            <Link className="button button-secondary" to="/login">I already have an account</Link>
          </div>
          <div className="landing-proof">
            <span className="proof-avatars"><i>SK</i><i>AM</i><i>JR</i></span>
            <span><strong>Less setup. More studying.</strong><small>Your first deck is minutes away.</small></span>
          </div>
        </div>

        <div className="landing-demo" aria-label="CardSparks deck generation preview">
          <div className="demo-glow" />
          <div className="demo-window">
            <div className="demo-window-head">
              <span><i /><i /><i /></span>
              <small>New AI deck</small>
              <span className="demo-live"><i /> Ready</span>
            </div>
            <div className="demo-prompt">
              <span className="demo-prompt-icon"><Icon name="sparkles" size={17} /></span>
              <div><small>Topic or prompt</small><strong>Cell biology for my midterm</strong></div>
              <span className="demo-count">12 cards</span>
            </div>
            <div className="demo-generating"><span><Icon name="check" size={14} /></span><div><strong>Your study deck is ready</strong><small>Review and edit before saving</small></div></div>
            <div className="demo-flashcard demo-card-one">
              <span><small>FRONT</small>What is the primary role of mitochondria?</span>
              <Icon name="arrowRight" size={16} />
              <span><small>BACK</small>They generate ATP through cellular respiration.</span>
            </div>
            <div className="demo-flashcard demo-card-two">
              <span><small>FRONT</small>Where are proteins assembled?</span>
              <Icon name="arrowRight" size={16} />
              <span><small>BACK</small>At ribosomes in the cytoplasm or rough ER.</span>
            </div>
            <div className="demo-window-foot"><span><Icon name="edit" size={14} /> Fully editable</span><strong>Save deck <Icon name="arrowRight" size={14} /></strong></div>
          </div>
          <div className="floating-stat floating-stat-top"><span><Icon name="cards" size={17} /></span><div><strong>12 cards</strong><small>made in seconds</small></div></div>
          <div className="floating-stat floating-stat-bottom"><span><Icon name="trophy" size={17} /></span><div><strong>91% recall</strong><small>this week</small></div></div>
        </div>
      </section>

      <section className="landing-value-strip" aria-label="CardSparks benefits">
        <div><Icon name="sparkles" size={18} /><span><strong>AI-generated</strong><small>From any topic</small></span></div>
        <div><Icon name="edit" size={18} /><span><strong>Always editable</strong><small>Your words, your way</small></span></div>
        <div><Icon name="clock" size={18} /><span><strong>Smart review</strong><small>Practice right on time</small></span></div>
        <div><Icon name="trophy" size={18} /><span><strong>Visible progress</strong><small>Know what’s sticking</small></span></div>
      </section>

      <section className="landing-how" id="how-it-works">
        <div className="landing-section-heading">
          <span className="eyebrow"><Icon name="sparkles" size={14} /> A simpler study loop</span>
          <h2>From “I should study” to <em>ready to go.</em></h2>
          <p>Start with a spark. Build real recall. Skip the hours of typing cards by hand.</p>
        </div>
        <div className="landing-step-grid">
          {steps.map((step) => (
            <article key={step.number}>
              <span className="step-number">{step.number}</span>
              <span className="step-icon"><Icon name={step.icon} size={24} /></span>
              <h3>{step.title}</h3>
              <p>{step.copy}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-final-cta">
        <span className="cta-spark cta-spark-one"><Icon name="sparkles" size={24} /></span>
        <span className="cta-spark cta-spark-two"><Icon name="sparkles" size={17} /></span>
        <div>
          <span className="eyebrow">Your next topic is waiting</span>
          <h2>Make the first card. Keep the knowledge.</h2>
          <p>Create an account and turn whatever you’re learning into a deck you’ll actually use.</p>
        </div>
        <Link className="button landing-white-cta" to="/signup">Create my first deck <Icon name="arrowRight" size={17} /></Link>
      </section>
    </div>
  )
}

