import { useRef, useState } from 'react';
import { CITY_ORDER, CITY_THEMES } from '../themes/cityThemes';
import type { CityId } from '../types/card';

interface OpeningOverlayProps {
  initialName: string;
  city: CityId;
  onCityPreviewChange: (city: CityId) => void;
  onOpenCard: (name: string, city: CityId) => void;
}

export function OpeningOverlay({
  initialName,
  city,
  onCityPreviewChange,
  onOpenCard,
}: OpeningOverlayProps) {
  const [name, setName] = useState(initialName);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const cleaned = name.trim();
    if (!cleaned) {
      setError('Please enter a name to personalize your card.');
      inputRef.current?.focus();
      return;
    }
    setError('');
    onOpenCard(cleaned, city);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    // IME-safe Enter guard (blocks premature submit during CJK/Korean composition)
    if (e.key === 'Enter' && (e.nativeEvent.isComposing || e.keyCode === 229)) {
      e.preventDefault();
    }
  };

  return (
    <section className="opening-overlay" aria-labelledby="opening-heading">
      <div className="opening-sheet">
        <h1 id="opening-heading" className="opening-title">
          <span className="accent-green">A Festive</span>{' '}
          <span className="accent-red">Pop-Up</span>{' '}
          <span className="accent-gold">For You</span>
        </h1>
        <p className="opening-sub">
          Personalize your 3D holiday card, pick a city, and decorate the tree with quirky charms.
        </p>

        <form className="opening-form" onSubmit={handleSubmit} noValidate>
          <div className="form-field">
            <label htmlFor="recipient-name" className="field-label">
              Your Name <span aria-hidden="true" className="accent-red">*</span>
            </label>
            <input
              ref={inputRef}
              id="recipient-name"
              name="recipientName"
              type="text"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (error) setError('');
              }}
              onKeyDown={handleInputKeyDown}
              placeholder="e.g. Anna"
              autoComplete="name"
              enterKeyHint="done"
              maxLength={48}
              required
              aria-invalid={error ? 'true' : undefined}
              aria-describedby={error ? 'name-error' : 'name-hint'}
              className="name-input"
            />
            <span id="name-hint" className="field-hint">
              Printed onto your card deck & festive greeting.
            </span>
            {error && (
              <p id="name-error" className="field-error" role="alert">
                {error}
              </p>
            )}
          </div>

          <fieldset className="city-fieldset">
            <legend className="field-label">Choose a City</legend>
            <div className="city-radio-row">
              {CITY_ORDER.map((cid) => {
                const theme = CITY_THEMES[cid];
                const checked = city === cid;
                return (
                  <label
                    key={cid}
                    className={`city-radio-pill ${checked ? 'is-selected' : ''}`}
                  >
                    <input
                      type="radio"
                      name="city"
                      value={cid}
                      checked={checked}
                      onChange={() => onCityPreviewChange(cid)}
                      className="visually-hidden"
                    />
                    <span className="city-pill-name">{theme.name}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>

          <button type="submit" className="open-card-btn">
            Unfold Holiday Card
          </button>
        </form>
      </div>
    </section>
  );
}
