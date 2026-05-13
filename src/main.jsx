import React, { useMemo, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Activity,
  Apple,
  BarChart3,
  Bot,
  CalendarDays,
  Camera,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  FileText,
  Home,
  Loader2,
  LogOut,
  MessageCircle,
  Pill,
  RefreshCw,
  Send,
  ShoppingBasket,
  Sparkles,
  Upload,
  Utensils,
  X,
} from 'lucide-react';
import './styles.css';

import { createClient } from '@supabase/supabase-js';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || '';
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Provide dummy values to prevent createClient from throwing a fatal synchronous error
const supabase = createClient(
  SUPABASE_URL || 'https://missing-project.supabase.co', 
  SUPABASE_ANON_KEY || 'missing-key'
);
const defaultUser = {
  id: '',
  name: 'Healthy User',
  dietType: 'not set',
  age: 28,
  height: 170,
  weight: 68,
  activityLevel: 'lightlyActive',
  goals: ['Improve deficiencies', 'Balanced meals'],
  allergies: [],
};

const tabs = [
  { id: 'home', label: 'Home', icon: Home },
  { id: 'plan', label: 'Plan', icon: CalendarDays },
  { id: 'track', label: 'Track', icon: BarChart3 },
  { id: 'profile', label: 'Profile', icon: CircleUserRound },
];

async function requestJson(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, options);
  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const message = typeof payload === 'string' ? payload : payload.message || payload.error || 'Request failed';
    throw new Error(message);
  }

  return payload;
}

function App() {
  const [activeTab, setActiveTab] = useState('home');
  const [overlay, setOverlay] = useState(null);
  const [user, setUser] = useState(defaultUser);
  const [healthData, setHealthData] = useState(null);
  const [mealLog, setMealLog] = useState([]);
  
  const [sessionUser, setSessionUser] = useState(null);
  const [authChecked, setAuthChecked] = useState(false);

  React.useEffect(() => {
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.warn('Supabase URL or Key missing.');
      setAuthChecked(true);
      return;
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSessionUser(session?.user || null);
      setAuthChecked(true);
      if (session?.user) loadUserProfile(session.user.id);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSessionUser(session?.user || null);
      if (session?.user) loadUserProfile(session.user.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  async function loadUserProfile(userId) {
    try {
      const payload = await requestJson(`/user/${userId}`);
      if (payload.data) {
        setUser({ ...defaultUser, ...payload.data, id: userId });
      } else {
        setUser({ ...defaultUser, id: userId });
      }
    } catch (e) {
      setUser({ ...defaultUser, id: userId });
    }
  }

  if (!authChecked) {
    return <div className="app-shell" style={{ display: 'grid', placeItems: 'center' }}><Loader2 className="spin" size={40} /></div>;
  }

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    return (
      <div className="auth-screen">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <h2 style={{ color: 'var(--red)', marginBottom: '10px' }}>Configuration Error</h2>
          <p>Please add <strong>VITE_SUPABASE_URL</strong> and <strong>VITE_SUPABASE_ANON_KEY</strong> to your Vercel Environment Variables and redeploy.</p>
        </div>
      </div>
    );
  }

  if (!sessionUser) {
    return <AuthScreen onAuthSuccess={setSessionUser} />;
  }

  const calorieGoal = useMemo(() => {
    const bmr = 10 * Number(user.weight || 68) + 6.25 * Number(user.height || 170) - 5 * Number(user.age || 28) + 5;
    const multiplier = {
      sedentary: 1.2,
      lightlyActive: 1.375,
      moderatelyActive: 1.55,
      veryActive: 1.725,
    }[user.activityLevel] || 1.2;
    return Math.round(bmr * multiplier);
  }, [user]);

  return (
    <div className="app-shell">
      <Sidebar activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="main-panel">
        {activeTab === 'home' && (
          <HomeScreen user={user} healthData={healthData} openOverlay={setOverlay} />
        )}
        {activeTab === 'plan' && <PlanScreen user={user} />}
        {activeTab === 'track' && <TrackingScreen calorieGoal={calorieGoal} mealLog={mealLog} />}
        {activeTab === 'profile' && <ProfileScreen user={user} setUser={setUser} />}
      </main>
      <MobileNav activeTab={activeTab} setActiveTab={setActiveTab} />
      <button className="chat-fab" type="button" aria-label="Open chat" onClick={() => setOverlay('chat')}>
        <MessageCircle size={22} />
      </button>
      {overlay === 'upload' && (
        <Dialog title="Upload Blood Report" onClose={() => setOverlay(null)}>
          <UploadReport user={user} setHealthData={setHealthData} onClose={() => setOverlay(null)} />
        </Dialog>
      )}
      {overlay === 'meal' && (
        <Dialog title="Scan Your Meal" onClose={() => setOverlay(null)}>
          <MealScan
            user={user}
            onLogged={(meal) => setMealLog((items) => [meal, ...items])}
            onClose={() => setOverlay(null)}
          />
        </Dialog>
      )}
      {overlay === 'store' && (
        <Dialog title="Smart Supplements Store" onClose={() => setOverlay(null)}>
          <StoreScreen />
        </Dialog>
      )}
      {overlay === 'chat' && (
        <Dialog title="NutriSense AI Assistant" subtitle="Online - Clinical Mode" onClose={() => setOverlay(null)}>
          <ChatScreen user={user} />
        </Dialog>
      )}
    </div>
  );
}

function AuthScreen({ onAuthSuccess }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      if (isLogin) {
        const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        onAuthSuccess(data.user);
      } else {
        const { data, error: signUpError } = await supabase.auth.signUp({ email, password });
        if (signUpError) throw signUpError;
        if (data.session) {
          onAuthSuccess(data.user);
        } else {
          setError('Sign up successful! Please check your email to confirm.');
        }
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="brand" style={{ justifyContent: 'center', marginBottom: '2rem' }}>
          <span className="brand-mark"><Apple size={32} /></span>
          <div>
            <strong>NutriSense</strong>
            <small>Clinical nutrition</small>
          </div>
        </div>
        <form onSubmit={handleSubmit} className="flow" style={{ padding: 0 }}>
          <Field label="Email" type="email" value={email} onChange={setEmail} />
          <Field label="Password" type="password" value={password} onChange={setPassword} />
          <button type="submit" className="primary-button" disabled={loading} style={{ marginTop: '8px' }}>
            {loading ? <Loader2 className="spin" size={18} /> : (isLogin ? 'Login' : 'Sign Up')}
          </button>
        </form>
        {error && <p className="error-box" style={{ marginTop: '1rem' }}>{error}</p>}
        <button 
          className="text-button" 
          onClick={() => { setIsLogin(!isLogin); setError(''); }} 
          style={{ marginTop: '1rem', width: '100%', background: 'transparent', border: 'none', color: 'var(--blue)', fontWeight: 600, cursor: 'pointer' }}
        >
          {isLogin ? "Don't have an account? Sign up" : "Already have an account? Login"}
        </button>
      </div>
    </div>
  );
}

function Sidebar({ activeTab, setActiveTab }) {
  return (
    <aside className="sidebar">
      <div className="brand">
        <span className="brand-mark"><Apple size={23} /></span>
        <div>
          <strong>NutriSense</strong>
          <small>Clinical nutrition</small>
        </div>
      </div>
      <nav className="side-nav" aria-label="Primary">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          return (
            <button className={activeTab === tab.id ? 'active' : ''} key={tab.id} onClick={() => setActiveTab(tab.id)}>
              <Icon size={20} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </nav>
    </aside>
  );
}

function MobileNav({ activeTab, setActiveTab }) {
  return (
    <nav className="mobile-nav" aria-label="Primary">
      {tabs.map((tab) => {
        const Icon = tab.icon;
        return (
          <button className={activeTab === tab.id ? 'active' : ''} key={tab.id} onClick={() => setActiveTab(tab.id)}>
            <Icon size={20} />
            <span>{tab.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function HomeScreen({ user, healthData, openOverlay }) {
  const deficiencies = (healthData?.markers || []).filter((marker) => marker.level && marker.level !== 'normal');

  return (
    <section className="screen">
      <header className="topbar">
        <div>
          <p>Good Morning,</p>
          <h1>{user.name || 'Healthy User'}</h1>
        </div>
        <div className="avatar"><CircleUserRound size={30} /></div>
      </header>

      {healthData ? (
        <>
          <HealthScore score={healthData.overallScore || healthData.overall_score || 78} />
          <SectionTitle>Your Deficiency Map</SectionTitle>
          <div className="grid two">
            {deficiencies.length ? deficiencies.map((marker) => <DeficiencyCard key={marker.key || marker.name} marker={marker} />) : (
              <EmptyPanel icon={CheckCircle2} title="No major deficiencies found" text="Your uploaded report did not flag any critical markers." />
            )}
          </div>
          <SectionTitle>Daily Suggestions</SectionTitle>
          <div className="suggestions">
            {(healthData.dailySuggestions || healthData.daily_suggestions || []).map((item) => (
              <p key={item}><CheckCircle2 size={18} />{item}</p>
            ))}
          </div>
        </>
      ) : (
        <EmptyPanel
          icon={Activity}
          title="No Clinical Data Found"
          text="Upload your blood report to get a personalized clinical nutrition plan."
          actionLabel="Upload Blood Report"
          onAction={() => openOverlay('upload')}
        />
      )}

      <SectionTitle>Quick Actions</SectionTitle>
      <div className="quick-actions">
        <ActionButton icon={Upload} label="Upload" tone="amber" onClick={() => openOverlay('upload')} />
        <ActionButton icon={Camera} label="Scan Meal" tone="blue" onClick={() => openOverlay('meal')} />
        <ActionButton icon={ShoppingBasket} label="Store" tone="green" onClick={() => openOverlay('store')} />
      </div>
    </section>
  );
}

function UploadReport({ user, setHealthData, onClose }) {
  const [file, setFile] = useState(null);
  const [dietType, setDietType] = useState(user.dietType || 'not set');
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  async function analyzeReport() {
    if (!file) return;
    setStatus('Extracting nutrients with Gemini AI...');
    setError('');

    try {
      const formData = new FormData();
      formData.append('report', file);
      formData.append('diet_type', dietType);
      if (user.id) formData.append('user_id', user.id);
      const result = await requestJson('/analyze-report', { method: 'POST', body: formData });
      setHealthData(result.data);
      setStatus('Analysis complete.');
      setTimeout(onClose, 450);
    } catch (err) {
      setError(err.message);
      setStatus('');
    }
  }

  return (
    <div className="flow">
      <label className="drop-zone">
        <input type="file" accept=".pdf,image/png,image/jpeg" onChange={(event) => setFile(event.target.files?.[0] || null)} />
        <FileText size={54} />
        <strong>{file ? file.name : 'Upload your PDF or image report'}</strong>
        <span>Select File</span>
      </label>
      <label className="field">
        <span>Diet type</span>
        <input value={dietType} onChange={(event) => setDietType(event.target.value)} placeholder="vegetarian, keto, not set" />
      </label>
      <button className="primary-button" disabled={!file || Boolean(status)} onClick={analyzeReport}>
        {status ? <Loader2 className="spin" size={18} /> : <Sparkles size={18} />}
        Analyze Report
      </button>
      {status && <p className="muted">{status}</p>}
      {error && <pre className="error-box">{error}</pre>}
      <p className="privacy">Your data is processed securely and privately.</p>
    </div>
  );
}

function MealScan({ user, onLogged, onClose }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function selectFile(event) {
    const nextFile = event.target.files?.[0] || null;
    setFile(nextFile);
    setResult(null);
    setError('');
    setPreview(nextFile ? URL.createObjectURL(nextFile) : '');
  }

  async function analyzeMeal() {
    if (!file) return;
    setLoading(true);
    setError('');

    try {
      const formData = new FormData();
      formData.append('image', file);
      formData.append('diet_type', user.dietType || 'not set');
      if (user.id) formData.append('user_id', user.id);
      const payload = await requestJson('/analyze-meal', { method: 'POST', body: formData });
      setResult(payload.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flow">
      <label className={preview ? 'meal-preview has-image' : 'meal-preview'}>
        <input type="file" accept="image/*" capture="environment" onChange={selectFile} />
        {preview ? <img src={preview} alt="" /> : <><Utensils size={72} /><strong>Snap your plate</strong><span>Open Camera</span></>}
      </label>
      <button className="primary-button" disabled={!file || loading} onClick={analyzeMeal}>
        {loading ? <Loader2 className="spin" size={18} /> : <Camera size={18} />}
        Analyze Meal
      </button>
      {loading && <p className="muted">Connecting clinical data to your food choices...</p>}
      {error && <pre className="error-box">{error}</pre>}
      {result && (
        <div className="result-stack">
          <div className="analysis-card">
            <h3><CheckCircle2 size={20} />Detected: {result.food_name || 'Meal'}</h3>
            <div className="macro-row">
              <Macro label="Calories" value={result.calories || '--'} />
              <Macro label="Protein" value={result.protein ? `${result.protein}g` : '--'} />
              <Macro label="Carbs" value={result.carbs ? `${result.carbs}g` : '--'} />
              <Macro label="Fat" value={result.fat ? `${result.fat}g` : '--'} />
            </div>
          </div>
          <div className="clinical-advice">
            <h3><Sparkles size={20} />Clinical Advice</h3>
            <p>{result.clinical_advice || 'No specific clinical advice for this meal.'}</p>
          </div>
          <button className="secondary-button" onClick={() => { onLogged(result); onClose(); }}>Log Meal</button>
        </div>
      )}
    </div>
  );
}

function PlanScreen({ user }) {
  const [selectedDay, setSelectedDay] = useState(0);
  const [planData, setPlanData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function loadPlan() {
    if (!user.id) {
      setError('Add a backend user ID in Profile before generating a plan.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const payload = await requestJson(`/plan/generate-plan?user_id=${encodeURIComponent(user.id)}`);
      setPlanData(payload.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  const weeklyPlan = planData?.weekly_plan || [];
  const currentMeals = weeklyPlan[selectedDay]?.meals;

  return (
    <section className="screen">
      <PageHeader title="Your Nutrition Plan" action={<IconButton label="Refresh plan" icon={RefreshCw} onClick={loadPlan} />} />
      {!planData && (
        <EmptyPanel
          icon={CalendarDays}
          title="Generate a clinical nutrition plan"
          text="Plans use your synced profile and latest uploaded report from the backend."
          actionLabel={loading ? 'Generating...' : 'Generate Plan'}
          onAction={loadPlan}
        />
      )}
      {error && <pre className="error-box">{error}</pre>}
      {loading && <LoadingPanel text="AI is crafting your clinical nutrition plan..." />}
      {weeklyPlan.length > 0 && (
        <>
          <div className="day-strip">
            {weeklyPlan.map((day, index) => (
              <button className={selectedDay === index ? 'selected' : ''} key={`${day.day}-${index}`} onClick={() => setSelectedDay(index)}>
                <strong>{String(day.day || `Day ${index + 1}`).slice(0, 3)}</strong>
                <span />
              </button>
            ))}
          </div>
          <SectionTitle>Today's Meals</SectionTitle>
          <div className="meal-list">
            <MealCard title="Breakfast" time="08:00 AM" meal={currentMeals?.breakfast} />
            <MealCard title="Lunch" time="01:30 PM" meal={currentMeals?.lunch} />
            <MealCard title="Snack" time="04:30 PM" meal={currentMeals?.snack} />
            <MealCard title="Dinner" time="08:30 PM" meal={currentMeals?.dinner} />
          </div>
          {!!planData?.prescribed_supplements?.length && (
            <div className="supplements">
              <h3><Pill size={20} />Clinical Supplements</h3>
              {planData.prescribed_supplements.map((item) => (
                <p key={`${item.name}-${item.timing}`}><CheckCircle2 size={16} /><strong>{item.name}</strong> {item.timing}</p>
              ))}
            </div>
          )}
        </>
      )}
    </section>
  );
}

function TrackingScreen({ calorieGoal, mealLog }) {
  const eaten = mealLog.reduce((sum, meal) => sum + Number(meal.calories || 0), 0);
  const remaining = calorieGoal - eaten;
  const progress = Math.min(1, eaten / calorieGoal);

  return (
    <section className="screen">
      <PageHeader title="Daily Tracking" />
      <div className="tracking-card">
        <div className="split-row"><strong>Calories Remaining</strong><strong>{remaining} kcal</strong></div>
        <div className="progress"><span style={{ width: `${progress * 100}%` }} /></div>
        <div className="macro-row">
          <Macro label="Eaten" value={eaten} />
          <Macro label="Burned" value="0" />
          <Macro label="Goal" value={calorieGoal} />
        </div>
      </div>
      <SectionTitle>Calorie History</SectionTitle>
      {mealLog.length ? (
        <div className="meal-log">{mealLog.map((meal, index) => <MealHistoryItem key={`${meal.food_name}-${index}`} meal={meal} />)}</div>
      ) : (
        <EmptyPanel icon={BarChart3} title="No history for today." text="Scan a meal to start tracking." />
      )}
      <SectionTitle>Nutrient Progress</SectionTitle>
      <Nutrient label="Protein" value={mealLog.reduce((sum, meal) => sum + Number(meal.protein || 0), 0)} max={90} />
      <Nutrient label="Carbs" value={0} max={250} tone="blue" />
      <Nutrient label="Fats" value={0} max={70} tone="amber" />
      <Nutrient label="Iron" value={0} max={18} tone="red" />
    </section>
  );
}

function ProfileScreen({ user, setUser }) {
  const [draft, setDraft] = useState(user);
  const [status, setStatus] = useState('');
  const [error, setError] = useState('');

  function updateField(field, value) {
    setDraft((current) => ({ ...current, [field]: value }));
  }

  async function saveProfile() {
    setStatus('Saving profile...');
    setError('');
    try {
      const payload = {
        ...draft,
        goals: String(draft.goals || '').split(',').map((item) => item.trim()).filter(Boolean),
        allergies: String(draft.allergies || '').split(',').map((item) => item.trim()).filter(Boolean),
      };
      setUser(payload);
      if (payload.id) await requestJson('/user/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      setStatus(payload.id ? 'Profile synced.' : 'Profile saved locally.');
    } catch (err) {
      setError(err.message);
      setStatus('');
    }
  }

  return (
    <section className="screen">
      <PageHeader title="Profile" />
      <div className="profile-hero">
        <div className="large-avatar"><CircleUserRound size={66} /></div>
        <h2>{draft.name || 'Healthy User'}</h2>
        <p>Premium Member</p>
      </div>
      <div className="form-grid">
        <Field label="Backend user ID" value={draft.id} onChange={(value) => updateField('id', value)} />
        <Field label="Name" value={draft.name} onChange={(value) => updateField('name', value)} />
        <Field label="Dietary Preference" value={draft.dietType} onChange={(value) => updateField('dietType', value)} />
        <Field label="Activity Level" value={draft.activityLevel} onChange={(value) => updateField('activityLevel', value)} />
        <Field label="Weight kg" type="number" value={draft.weight} onChange={(value) => updateField('weight', value)} />
        <Field label="Height cm" type="number" value={draft.height} onChange={(value) => updateField('height', value)} />
        <Field label="Age" type="number" value={draft.age} onChange={(value) => updateField('age', value)} />
        <Field label="Allergies" value={Array.isArray(draft.allergies) ? draft.allergies.join(', ') : draft.allergies} onChange={(value) => updateField('allergies', value)} />
        <label className="field wide">
          <span>Health Goals</span>
          <textarea value={Array.isArray(draft.goals) ? draft.goals.join(', ') : draft.goals} onChange={(event) => updateField('goals', event.target.value)} />
        </label>
      </div>
      <button className="primary-button" onClick={saveProfile}><CheckCircle2 size={18} />Save Profile</button>
      {status && <p className="muted">{status}</p>}
      {error && <pre className="error-box">{error}</pre>}
      <button 
        className="danger-button" 
        type="button" 
        onClick={async () => {
          if (SUPABASE_URL && SUPABASE_ANON_KEY) await supabase.auth.signOut();
        }}
      >
        <LogOut size={18} />Logout
      </button>
    </section>
  );
}

function ChatScreen({ user }) {
  const [messages, setMessages] = useState([
    { text: "Hello! I'm your NutriSense AI. How can I help you optimize your nutrition today?", isUser: false },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const listRef = useRef(null);

  async function sendMessage(event) {
    event?.preventDefault();
    if (!input.trim()) return;
    const userMessage = input.trim();
    setMessages((items) => [...items, { text: userMessage, isUser: true }]);
    setInput('');
    setLoading(true);

    try {
      const payload = await requestJson('/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage, ...(user.id ? { user_id: user.id } : {}) }),
      });
      const reply = payload.response || payload.data?.reply || 'I could not read the assistant response.';
      setMessages((items) => [...items, { text: reply, isUser: false }]);
      setTimeout(() => listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: 'smooth' }), 0);
    } catch (err) {
      setMessages((items) => [...items, { text: `Error: ${err.message}`, isUser: false }]);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="chat-panel">
      <div className="chat-messages" ref={listRef}>
        {messages.map((message, index) => (
          <div className={message.isUser ? 'bubble user' : 'bubble'} key={`${message.text}-${index}`}>{message.text}</div>
        ))}
        {loading && <div className="bubble loading"><Loader2 className="spin" size={18} /></div>}
      </div>
      <form className="chat-input" onSubmit={sendMessage}>
        <input value={input} onChange={(event) => setInput(event.target.value)} placeholder="Ask about your nutrition..." />
        <button type="submit" aria-label="Send message"><Send size={18} /></button>
      </form>
    </div>
  );
}

function StoreScreen() {
  return (
    <EmptyPanel
      icon={ShoppingBasket}
      title="Personalized Store"
      text="We are curating high-quality supplements and meal plans that match your clinical deficiencies. Check back soon!"
    />
  );
}

function HealthScore({ score }) {
  return (
    <div className="health-score">
      <div>
        <span>Health Score</span>
        <strong>{score}</strong>
      </div>
      <div className="score-ring" style={{ '--score': `${score}%` }}>{score}</div>
    </div>
  );
}

function DeficiencyCard({ marker }) {
  return (
    <article className="deficiency-card">
      <div><Pill size={20} /></div>
      <section>
        <strong>{marker.name || marker.key || 'Marker'}</strong>
        <p>{marker.status || marker.level || 'Needs attention'}</p>
      </section>
      <ChevronRight size={18} />
    </article>
  );
}

function MealCard({ title, time, meal }) {
  return (
    <article className="meal-card">
      <span><Utensils size={20} /></span>
      <div>
        <div className="split-row"><strong>{title}</strong><small>{time}</small></div>
        <p>{meal?.menu || 'Not generated yet'}</p>
        <div className="chips">
          <em>{meal?.calories || '--'} kcal</em>
          <em>{meal?.target || 'Clinical target'}</em>
        </div>
      </div>
    </article>
  );
}

function MealHistoryItem({ meal }) {
  return (
    <article className="history-item">
      <strong>{meal.food_name || 'Logged meal'}</strong>
      <span>{meal.calories || '--'} kcal</span>
    </article>
  );
}

function Nutrient({ label, value, max, tone = 'green' }) {
  const percent = Math.min(100, Math.round((Number(value || 0) / max) * 100));
  return (
    <div className={`nutrient ${tone}`}>
      <div className="split-row"><strong>{label}</strong><span>{percent}%</span></div>
      <div className="progress"><span style={{ width: `${percent}%` }} /></div>
    </div>
  );
}

function EmptyPanel({ icon: Icon, title, text, actionLabel, onAction }) {
  return (
    <div className="empty-panel">
      <Icon size={56} />
      <h2>{title}</h2>
      <p>{text}</p>
      {actionLabel && <button className="primary-button" onClick={onAction}>{actionLabel}</button>}
    </div>
  );
}

function LoadingPanel({ text }) {
  return <div className="loading-panel"><Loader2 className="spin" size={24} />{text}</div>;
}

function Dialog({ title, subtitle, onClose, children }) {
  return (
    <div className="dialog-backdrop" role="presentation">
      <section className="dialog" role="dialog" aria-modal="true" aria-labelledby="dialog-title">
        <header>
          <div>
            <h2 id="dialog-title">{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          <button type="button" aria-label="Close dialog" onClick={onClose}><X size={20} /></button>
        </header>
        {children}
      </section>
    </div>
  );
}

function PageHeader({ title, action }) {
  return (
    <header className="page-header">
      <h1>{title}</h1>
      {action}
    </header>
  );
}

function SectionTitle({ children }) {
  return <h2 className="section-title">{children}</h2>;
}

function ActionButton({ icon: Icon, label, tone, onClick }) {
  return (
    <button className={`action ${tone}`} onClick={onClick}>
      <Icon size={24} />
      <strong>{label}</strong>
    </button>
  );
}

function IconButton({ icon: Icon, label, onClick }) {
  return <button className="icon-button" aria-label={label} onClick={onClick}><Icon size={19} /></button>;
}

function Macro({ label, value }) {
  return <div className="macro"><strong>{value}</strong><span>{label}</span></div>;
}

function Field({ label, type = 'text', value, onChange }) {
  return (
    <label className="field">
      <span>{label}</span>
      <input type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

createRoot(document.getElementById('root')).render(<App />);
