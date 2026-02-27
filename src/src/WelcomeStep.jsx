import React from "react";
import { ArrowRight, Heart, Sparkles, Sun, Zap } from "lucide-react";
import "./WelcomeStep.css";

const HIGHLIGHTS = [
  {
    title: "Send Greetings",
    detail: "Share safe, pre-written positive messages.",
    icon: Sun,
    iconClassName: "welcome-step__icon-wrap--sun",
  },
  {
    title: "Improve Mental Health",
    detail: "Build a daily habit of connection.",
    icon: Heart,
    iconClassName: "welcome-step__icon-wrap--heart",
  },
  {
    title: "Earn Sparks",
    detail: "Level up as you spread joy globally.",
    icon: Zap,
    iconClassName: "welcome-step__icon-wrap--zap",
  },
];

function WelcomeStep({ onStartJourney }) {
  return (
    <div className="welcome-step">
      <div className="welcome-step__content">
        <div className="welcome-step__logo-wrap">
          <Sparkles size={34} />
        </div>

        <h1 className="welcome-step__title">Uplift</h1>
        <p className="welcome-step__subtitle">
          Science shows that small positive interactions—even with strangers—significantly boost your mood and
          well-being.
        </p>

        <div className="welcome-step__list">
          {HIGHLIGHTS.map(({ title, detail, icon: Icon, iconClassName }) => (
            <article className="welcome-step__item" key={title}>
              <div className={`welcome-step__icon-wrap ${iconClassName}`}>
                <Icon size={16} />
              </div>
              <div>
                <h2 className="welcome-step__item-title">{title}</h2>
                <p className="welcome-step__item-detail">{detail}</p>
              </div>
            </article>
          ))}
        </div>
      </div>

      <button className="welcome-step__cta" onClick={onStartJourney}>
        Start Your Journey <ArrowRight size={18} />
      </button>
    </div>
  );
}

export default WelcomeStep;
