import { useEffect, useMemo, useState } from 'react';
import { supabase, isSupabaseReady, loadAppState, persistAppState } from './lib/supabase';

const STORAGE_KEY = 'mkekashare-state-v1';
const countryCodes = [
  { code: '+255', label: 'Tanzania (+255)' },
  { code: '+256', label: 'Uganda (+256)' },
  { code: '+254', label: 'Kenya (+254)' },
  { code: '+27', label: 'South Africa (+27)' },
  { code: '+1', label: 'United States (+1)' },
  { code: '+44', label: 'United Kingdom (+44)' },
];

const bettingCompanies = [
  'SportyBet',
  'BetWay',
  '888bet',
  'PremierBet',
  'Meridianbet',
  'GSMBet',
  '1xBet',
  'Bet365',
  'MozzartBet',
  'Bet9ja',
];

const reactionIcons = {
  like: '👍',
  fire: '🔥',
  heart: '❤️',
};

const tabs = [
  { id: 'home', label: 'Home', icon: '⌂' },
  { id: 'explore', label: 'Explore', icon: '◎' },
  { id: 'messages', label: 'Messages', icon: '✉' },
  { id: 'profile', label: 'Profile', icon: '◉' },
];

const createId = () =>
  typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

const getInitialState = () => {
  const stored = loadAppState(STORAGE_KEY);

  if (stored) {
    return stored;
  }

  return {
    theme: 'light',
    currentUserId: null,
    profiles: [],
    posts: [],
    comments: [],
    reactions: [],
    follows: [],
    messages: [],
    vipPurchases: [],
    verificationRequests: [],
  };
};

function App() {
  const [appState, setAppState] = useState(getInitialState);
  const [authMode, setAuthMode] = useState('login');
  const [activeTab, setActiveTab] = useState('home');
  const [composerOpen, setComposerOpen] = useState(false);
  const [commentPostId, setCommentPostId] = useState(null);
  const [chatTargetId, setChatTargetId] = useState(null);
  const [authForm, setAuthForm] = useState({
    fullName: '',
    email: '',
    password: '',
    phone: '',
    countryCode: '+255',
    role: 'user',
  });
  const [postDraft, setPostDraft] = useState({
    title: '',
    company: 'SportyBet',
    customCompany: '',
    odds: '',
    code: '',
    isVip: false,
    vipPrice: '5000',
    vipCurrency: 'TSH',
  });
  const [commentDraft, setCommentDraft] = useState('');
  const [chatDraft, setChatDraft] = useState('');

  const currentUser = useMemo(
    () => appState.profiles.find((profile) => profile.id === appState.currentUserId) || null,
    [appState.profiles, appState.currentUserId],
  );

  useEffect(() => {
    const theme = appState.theme === 'dark' ? 'dark' : 'light';
    document.body.dataset.theme = theme;
    persistAppState(STORAGE_KEY, appState);
  }, [appState]);

  useEffect(() => {
    if (!isSupabaseReady()) return;

    const channel = supabase
      .channel('mkekashare-live-updates')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public' },
        () => {
          const synced = loadAppState(STORAGE_KEY);
          if (synced) setAppState(synced);
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const profilesById = useMemo(
    () => Object.fromEntries(appState.profiles.map((profile) => [profile.id, profile])),
    [appState.profiles],
  );

  const sortedPosts = useMemo(
    () => [...appState.posts].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)),
    [appState.posts],
  );

  const myFollows = useMemo(
    () =>
      currentUser
        ? appState.follows.filter((follow) => follow.followerId === currentUser.id)
        : [],
    [appState.follows, currentUser],
  );

  const findTipsterById = (id) => profilesById[id] || null;

  const updateState = (updater) => {
    setAppState((prev) => {
      const next = typeof updater === 'function' ? updater(prev) : updater;
      return next;
    });
  };

  const handleAuthInput = (field, value) => {
    setAuthForm((prev) => ({ ...prev, [field]: value }));
  };

  const handleCreateAccount = () => {
    const email = authForm.email.trim();
    const phone = authForm.phone.trim();
    const name = authForm.fullName.trim();
    if (!email || !passwordValid(authForm.password) || !name || !phone) {
      alert('Please complete all required fields with a valid password and phone number.');
      return;
    }

    const existing = appState.profiles.find(
      (profile) => profile.email.toLowerCase() === email.toLowerCase(),
    );

    if (existing) {
      alert('An account with this email already exists. Please log in instead.');
      return;
    }

    const newProfile = {
      id: createId(),
      fullName: name,
      email,
      password: authForm.password,
      phone: `${authForm.countryCode}${phone}`,
      role: authForm.role,
      avatar: createInitials(name),
      isVerified: false,
      verificationInfo: null,
      bio: 'Tipster sharing verified betting picks',
      socialLinks: { instagram: '', tiktok: '', facebook: '', x: '' },
      createdAt: new Date().toISOString(),
    };

    updateState((prev) => ({
      ...prev,
      currentUserId: newProfile.id,
      profiles: [...prev.profiles, newProfile],
    }));

    setAuthForm({
      fullName: '',
      email: '',
      password: '',
      phone: '',
      countryCode: '+255',
      role: 'user',
    });
    setActiveTab('home');
  };

  const handleLogin = () => {
    const email = authForm.email.trim();
    const account = appState.profiles.find(
      (profile) => profile.email.toLowerCase() === email.toLowerCase() && profile.password === authForm.password,
    );

    if (!account) {
      alert('Invalid email or password.');
      return;
    }

    updateState((prev) => ({ ...prev, currentUserId: account.id }));
    setAuthForm({
      fullName: '',
      email: '',
      password: '',
      phone: '',
      countryCode: '+255',
      role: 'user',
    });
    setActiveTab('home');
  };

  const handleLogout = () => {
    updateState((prev) => ({ ...prev, currentUserId: null }));
    setAuthMode('login');
    setActiveTab('home');
  };

  const handleCreatePost = () => {
    if (!currentUser || currentUser.role !== 'tipster') {
      alert('Only verified tipsters can post booking codes.');
      return;
    }

    const company = postDraft.customCompany.trim() || postDraft.company;
    const code = postDraft.code.trim();
    const odds = postDraft.odds.trim();

    if (!company || !code || !odds) {
      alert('Please add a betting company, odds, and booking code.');
      return;
    }

    const post = {
      id: createId(),
      authorId: currentUser.id,
      company,
      odds,
      code,
      isVip: postDraft.isVip,
      vipPrice: postDraft.isVip ? Number(postDraft.vipPrice || 0) : 0,
      vipCurrency: postDraft.isVip ? postDraft.vipCurrency : 'TSH',
      createdAt: new Date().toISOString(),
    };

    updateState((prev) => ({
      ...prev,
      posts: [post, ...prev.posts],
    }));

    setComposerOpen(false);
    setPostDraft({
      title: '',
      company: 'SportyBet',
      customCompany: '',
      odds: '',
      code: '',
      isVip: false,
      vipPrice: '5000',
      vipCurrency: 'TSH',
    });
  };

  const handleCopyCode = async (code) => {
    try {
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(code);
      }
      alert('Booking code copied to clipboard.');
    } catch (error) {
      alert('Copy failed. Please try again.');
    }
  };

  const handleToggleFollow = (tipsterId) => {
    if (!currentUser) return;

    const isFollowing = appState.follows.some(
      (follow) => follow.followerId === currentUser.id && follow.tipsterId === tipsterId,
    );

    updateState((prev) => ({
      ...prev,
      follows: isFollowing
        ? prev.follows.filter(
            (follow) => !(follow.followerId === currentUser.id && follow.tipsterId === tipsterId),
          )
        : [...prev.follows, { id: createId(), followerId: currentUser.id, tipsterId }],
    }));
  };

  const handleUnlockVip = (postId) => {
    if (!currentUser) return;

    const alreadyBought = appState.vipPurchases.some(
      (purchase) => purchase.postId === postId && purchase.userId === currentUser.id,
    );

    if (alreadyBought) return;

    updateState((prev) => ({
      ...prev,
      vipPurchases: [...prev.vipPurchases, { id: createId(), userId: currentUser.id, postId }],
    }));
  };

  const handleReaction = (postId, type) => {
    if (!currentUser) return;

    const existing = appState.reactions.find(
      (reaction) => reaction.postId === postId && reaction.userId === currentUser.id,
    );

    updateState((prev) => {
      if (!existing) {
        return {
          ...prev,
          reactions: [...prev.reactions, { id: createId(), postId, userId: currentUser.id, type }],
        };
      }

      if (existing.type === type) {
        return {
          ...prev,
          reactions: prev.reactions.filter((reaction) => reaction.id !== existing.id),
        };
      }

      return {
        ...prev,
        reactions: prev.reactions.map((reaction) =>
          reaction.id === existing.id ? { ...reaction, type } : reaction,
        ),
      };
    });
  };

  const handleCommentSave = () => {
    if (!currentUser || !commentPostId || !commentDraft.trim()) return;

    const comment = {
      id: createId(),
      postId: commentPostId,
      userId: currentUser.id,
      message: commentDraft.trim(),
      createdAt: new Date().toISOString(),
    };

    updateState((prev) => ({
      ...prev,
      comments: [...prev.comments, comment],
    }));

    setCommentDraft('');
    setCommentPostId(null);
  };

  const handleVerificationSubmit = (form) => {
    if (!currentUser) return;

    const payload = {
      id: createId(),
      profileId: currentUser.id,
      fullName: form.fullName,
      socialLinks: form.socialLinks,
      submittedAt: new Date().toISOString(),
      status: 'approved',
    };

    updateState((prev) => ({
      ...prev,
      verificationRequests: [...prev.verificationRequests, payload],
      profiles: prev.profiles.map((profile) =>
        profile.id === currentUser.id
          ? {
              ...profile,
              fullName: form.fullName,
              isVerified: true,
              socialLinks: form.socialLinks,
              verificationInfo: payload,
            }
          : profile,
      ),
    }));

    alert('Verification submitted and approved for your profile.');
  };

  const handleSendMessage = () => {
    if (!currentUser || !chatTargetId || !chatDraft.trim()) return;

    const message = {
      id: createId(),
      senderId: currentUser.id,
      receiverId: chatTargetId,
      message: chatDraft.trim(),
      createdAt: new Date().toISOString(),
    };

    updateState((prev) => ({
      ...prev,
      messages: [...prev.messages, message],
    }));

    setChatDraft('');
  };

  const availableTipsters = appState.profiles.filter((profile) => profile.role === 'tipster');
  const commentList = appState.comments.filter((comment) => comment.postId === commentPostId);

  if (!currentUser) {
    return (
      <div className="shell auth-shell">
        <div className="auth-card">
          <div className="brand-lockup">
            <div className="brand-mark">M</div>
            <div>
              <p className="eyebrow">Betting Tipster Platform</p>
              <h1>MkekaShare</h1>
            </div>
          </div>

          <div className="auth-toggle">
            <button
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => setAuthMode('login')}
            >
              Log in
            </button>
            <button
              className={authMode === 'signup' ? 'active' : ''}
              onClick={() => setAuthMode('signup')}
            >
              Sign up
            </button>
          </div>

          <div className="form-stack">
            {authMode === 'signup' && (
              <label>
                Full name
                <input
                  value={authForm.fullName}
                  onChange={(event) => handleAuthInput('fullName', event.target.value)}
                  placeholder="Your legal name"
                />
              </label>
            )}

            <label>
              Email address
              <input
                type="email"
                value={authForm.email}
                onChange={(event) => handleAuthInput('email', event.target.value)}
                placeholder="you@email.com"
              />
            </label>

            <label>
              Password
              <input
                type="password"
                value={authForm.password}
                onChange={(event) => handleAuthInput('password', event.target.value)}
                placeholder="Enter a secure password"
              />
            </label>

            {authMode === 'signup' && (
              <>
                <div className="phone-picker">
                  <select
                    value={authForm.countryCode}
                    onChange={(event) => handleAuthInput('countryCode', event.target.value)}
                  >
                    {countryCodes.map((country) => (
                      <option key={country.code} value={country.code}>
                        {country.label}
                      </option>
                    ))}
                  </select>
                  <input
                    type="tel"
                    value={authForm.phone}
                    onChange={(event) => handleAuthInput('phone', event.target.value)}
                    placeholder="Phone number"
                  />
                </div>

                <label>
                  Account type
                  <select value={authForm.role} onChange={(event) => handleAuthInput('role', event.target.value)}>
                    <option value="user">Regular user</option>
                    <option value="tipster">Tipster</option>
                  </select>
                </label>
              </>
            )}

            <button
              className="primary-button"
              onClick={authMode === 'login' ? handleLogin : handleCreateAccount}
            >
              {authMode === 'login' ? 'Log in' : 'Create account'}
            </button>

            {authMode === 'login' && (
              <button className="ghost-button" onClick={() => alert('OTP flow UI ready for SMS/email recovery.') }>
                Forgot password?
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="shell app-shell">
      <header className="topbar">
        <div>
          <p className="eyebrow">Welcome back</p>
          <h2>{currentUser.fullName}</h2>
        </div>

        <div className="topbar-actions">
          <button className="icon-button" onClick={() => setAppState((prev) => ({ ...prev, theme: prev.theme === 'dark' ? 'light' : 'dark' }))}>
            {appState.theme === 'dark' ? '☀' : '☾'}
          </button>
          <button className="icon-button" onClick={handleLogout}>↩</button>
        </div>
      </header>

      {activeTab === 'home' && (
        <HomeScreen
          currentUser={currentUser}
          posts={sortedPosts}
          profilesById={profilesById}
          reactions={appState.reactions}
          comments={appState.comments}
          follows={appState.follows}
          vipPurchases={appState.vipPurchases}
          onCopyCode={handleCopyCode}
          onReact={handleReaction}
          onOpenComments={setCommentPostId}
          onFollow={handleToggleFollow}
          onUnlockVip={handleUnlockVip}
          onNewPost={() => setComposerOpen(true)}
        />
      )}

      {activeTab === 'explore' && (
        <ExploreScreen
          currentUser={currentUser}
          profiles={availableTipsters}
          follows={appState.follows}
          onFollow={handleToggleFollow}
          onMessage={(id) => {
            setChatTargetId(id);
            setActiveTab('messages');
          }}
        />
      )}

      {activeTab === 'messages' && (
        <MessagesScreen
          currentUser={currentUser}
          profilesById={profilesById}
          messages={appState.messages}
          onSelectConversation={setChatTargetId}
          selectedConversationId={chatTargetId}
          chatDraft={chatDraft}
          setChatDraft={setChatDraft}
          onSend={handleSendMessage}
        />
      )}

      {activeTab === 'profile' && (
        <ProfileScreen
          currentUser={currentUser}
          profilesById={profilesById}
          follows={appState.follows}
          onVerificationSubmit={handleVerificationSubmit}
        />
      )}

      <nav className="bottom-tabbar">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            className={activeTab === tab.id ? 'tab active' : 'tab'}
            onClick={() => setActiveTab(tab.id)}
          >
            <span>{tab.icon}</span>
            <small>{tab.label}</small>
          </button>
        ))}
      </nav>

      {composerOpen && (
        <div className="modal-overlay" onClick={() => setComposerOpen(false)}>
          <div className="sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-header">
              <h3>Share a booking code</h3>
              <button className="text-button" onClick={() => setComposerOpen(false)}>Close</button>
            </div>

            <div className="toggle-group">
              <button
                className={postDraft.isVip ? '' : 'active'}
                onClick={() => setPostDraft((prev) => ({ ...prev, isVip: false }))}
              >
                Free Tip
              </button>
              <button
                className={postDraft.isVip ? 'active' : ''}
                onClick={() => setPostDraft((prev) => ({ ...prev, isVip: true }))}
              >
                VIP / Paid Tip
              </button>
            </div>

            <div className="form-stack compact">
              <label>
                Betting company
                <select
                  value={postDraft.company}
                  onChange={(event) => setPostDraft((prev) => ({ ...prev, company: event.target.value }))}
                >
                  {bettingCompanies.map((company) => (
                    <option key={company} value={company}>
                      {company}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Custom company (optional)
                <input
                  value={postDraft.customCompany}
                  onChange={(event) => setPostDraft((prev) => ({ ...prev, customCompany: event.target.value }))}
                  placeholder="If not listed, type it here"
                />
              </label>

              <label>
                Total odds
                <input
                  value={postDraft.odds}
                  onChange={(event) => setPostDraft((prev) => ({ ...prev, odds: event.target.value }))}
                  placeholder="e.g. 2.15"
                />
              </label>

              <label>
                Booking code
                <input
                  value={postDraft.code}
                  onChange={(event) => setPostDraft((prev) => ({ ...prev, code: event.target.value }))}
                  placeholder="e.g. 2-1-X"
                />
              </label>

              {postDraft.isVip && (
                <div className="inline-fields">
                  <input
                    value={postDraft.vipPrice}
                    onChange={(event) => setPostDraft((prev) => ({ ...prev, vipPrice: event.target.value }))}
                    placeholder="Price"
                  />
                  <select
                    value={postDraft.vipCurrency}
                    onChange={(event) => setPostDraft((prev) => ({ ...prev, vipCurrency: event.target.value }))}
                  >
                    <option value="TSH">TSH</option>
                    <option value="USD">USD</option>
                  </select>
                </div>
              )}

              <button className="primary-button" onClick={handleCreatePost}>Post code</button>
            </div>
          </div>
        </div>
      )}

      {commentPostId && (
        <div className="modal-overlay" onClick={() => setCommentPostId(null)}>
          <div className="sheet comments-sheet" onClick={(event) => event.stopPropagation()}>
            <div className="sheet-header">
              <h3>Comments</h3>
              <button className="text-button" onClick={() => setCommentPostId(null)}>Close</button>
            </div>

            <div className="comment-list">
              {commentList.length === 0 ? (
                <div className="empty-inline">No comments yet. Be the first to share your thought.</div>
              ) : (
                commentList.map((comment) => (
                  <div key={comment.id} className="comment-item">
                    <div className="avatar mini">{createInitials(findTipsterById(comment.userId)?.fullName || 'User')}</div>
                    <div>
                      <strong>{findTipsterById(comment.userId)?.fullName || 'User'}</strong>
                      <p>{comment.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="composer-row">
              <input
                value={commentDraft}
                placeholder="Write a comment"
                onChange={(event) => setCommentDraft(event.target.value)}
              />
              <button className="primary-button" onClick={handleCommentSave}>Send</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function HomeScreen({
  currentUser,
  posts,
  profilesById,
  reactions,
  comments,
  follows,
  vipPurchases,
  onCopyCode,
  onReact,
  onOpenComments,
  onFollow,
  onUnlockVip,
  onNewPost,
}) {
  const canPost = currentUser && currentUser.role === 'tipster';

  return (
    <main className="page stack">
      <div className="section-row">
        <div>
          <p className="eyebrow">Today&apos;s picks</p>
          <h3>Home feed</h3>
        </div>
        {canPost && (
          <button className="primary-button small" onClick={onNewPost}>+ Post</button>
        )}
      </div>

      {posts.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">✦</div>
          <h4>No booking codes posted yet.</h4>
          <p>Be the first to share!</p>
          {canPost && <button className="primary-button" onClick={onNewPost}>+ Post</button>}
        </div>
      ) : (
        posts.map((post) => {
          const author = profilesById[post.authorId] || { fullName: 'Unknown', avatar: 'U' };
          const userAlreadyPurchased = vipPurchases.some(
            (purchase) => purchase.postId === post.id && purchase.userId === currentUser.id,
          );
          const isFollowing = follows.some(
            (follow) => follow.followerId === currentUser.id && follow.tipsterId === post.authorId,
          );

          const visibleCode = post.isVip && !userAlreadyPurchased && currentUser.id !== post.authorId
            ? 'VIP • Locked'
            : post.code;

          const reactionsForPost = reactions.filter((reaction) => reaction.postId === post.id);
          const counts = {
            like: reactionsForPost.filter((reaction) => reaction.type === 'like').length,
            fire: reactionsForPost.filter((reaction) => reaction.type === 'fire').length,
            heart: reactionsForPost.filter((reaction) => reaction.type === 'heart').length,
          };

          return (
            <article key={post.id} className="card post-card">
              <div className="card-header">
                <div className="profile-badge">
                  <div className="avatar">{author.avatar}</div>
                  <div>
                    <div className="name-bar">
                      <strong>{author.fullName}</strong>
                      {author.isVerified && <span className="verified-badge">✓</span>}
                    </div>
                    <p>{author.role === 'tipster' ? 'Tipster' : 'Member'}</p>
                  </div>
                </div>

                <button className="outline-button" onClick={() => onFollow(post.authorId)}>
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
              </div>

              <div className="meta-row">
                <span className="company-badge">{post.company}</span>
                <span className="odds-pill">Odds {post.odds}</span>
              </div>

              <div className={post.isVip && !userAlreadyPurchased && currentUser.id !== post.authorId ? 'vip-blur' : ''}>
                <div className="betting-code-box">
                  <div>
                    <p className="label">Booking code</p>
                    <h4>{visibleCode}</h4>
                  </div>
                  <button className="copy-button" onClick={() => onCopyCode(post.code)}>
                    Copy Code
                  </button>
                </div>
              </div>

              {post.isVip && !userAlreadyPurchased && currentUser.id !== post.authorId && (
                <button className="vip-button" onClick={() => onUnlockVip(post.id)}>
                  Unlock VIP Code for {post.vipPrice} {post.vipCurrency}
                </button>
              )}

              <div className="reaction-row">
                {Object.entries(reactionIcons).map(([type, icon]) => (
                  <button className="reaction-button" key={type} onClick={() => onReact(post.id, type)}>
                    <span>{icon}</span>
                    <small>{counts[type]}</small>
                  </button>
                ))}
                <button className="text-button" onClick={() => onOpenComments(post.id)}>
                  💬 {comments.filter((comment) => comment.postId === post.id).length}
                </button>
              </div>
            </article>
          );
        })
      )}
    </main>
  );
}

function ExploreScreen({ currentUser, profiles, follows, onFollow, onMessage }) {
  return (
    <main className="page stack">
      <div className="section-row">
        <div>
          <p className="eyebrow">Discover</p>
          <h3>Tipsters</h3>
        </div>
      </div>

      {profiles.length === 0 ? (
        <div className="empty-state compact">
          <h4>No tipsters yet</h4>
          <p>Sign up as a tipster to start sharing picks.</p>
        </div>
      ) : (
        profiles.map((profile) => {
          const isFollowing = follows.some(
            (follow) => follow.followerId === currentUser.id && follow.tipsterId === profile.id,
          );

          return (
            <article key={profile.id} className="card list-card">
              <div className="profile-badge">
                <div className="avatar">{profile.avatar}</div>
                <div>
                  <div className="name-bar">
                    <strong>{profile.fullName}</strong>
                    {profile.isVerified && <span className="verified-badge">✓</span>}
                  </div>
                  <p>{profile.role === 'tipster' ? 'Verified Tipster' : 'Member'}</p>
                </div>
              </div>

              <div className="inline-actions">
                <button className="outline-button" onClick={() => onFollow(profile.id)}>
                  {isFollowing ? 'Following' : 'Follow'}
                </button>
                <button className="primary-button small" onClick={() => onMessage(profile.id)}>
                  Message
                </button>
              </div>
            </article>
          );
        })
      )}
    </main>
  );
}

function MessagesScreen({ currentUser, profilesById, messages, onSelectConversation, selectedConversationId, chatDraft, setChatDraft, onSend }) {
  const conversations = useMemo(() => {
    const map = new Map();
    messages.forEach((message) => {
      const otherUserId = message.senderId === currentUser.id ? message.receiverId : message.senderId;
      if (!map.has(otherUserId)) {
        map.set(otherUserId, []);
      }
      map.get(otherUserId).push(message);
    });
    return Array.from(map.entries()).map(([otherUserId, threadMessages]) => ({
      otherUserId,
      messages: threadMessages.sort((a, b) => new Date(a.createdAt) - new Date(b.createdAt)),
    }));
  }, [currentUser.id, messages]);

  const selectedConversation = conversations.find((item) => item.otherUserId === selectedConversationId) || conversations[0];

  return (
    <main className="page stack">
      <div className="section-row">
        <div>
          <p className="eyebrow">Inbox</p>
          <h3>Messages</h3>
        </div>
      </div>

      {conversations.length === 0 ? (
        <div className="empty-state compact">
          <h4>No chats yet</h4>
          <p>Message a tipster from their profile to get started.</p>
        </div>
      ) : (
        <div className="messages-layout">
          <div className="conversation-list">
            {conversations.map((conversation) => {
              const profile = profilesById[conversation.otherUserId];
              const lastMessage = conversation.messages[conversation.messages.length - 1];

              return (
                <button
                  key={conversation.otherUserId}
                  className={selectedConversation?.otherUserId === conversation.otherUserId ? 'thread active' : 'thread'}
                  onClick={() => onSelectConversation(conversation.otherUserId)}
                >
                  <span className="avatar mini">{profile?.avatar || 'U'}</span>
                  <div>
                    <strong>{profile?.fullName || 'Unknown'}</strong>
                    <small>{lastMessage?.message || 'Started a conversation'}</small>
                  </div>
                </button>
              );
            })}
          </div>

          {selectedConversation && (
            <div className="chat-panel">
              <div className="chat-header">
                <strong>{profilesById[selectedConversation.otherUserId]?.fullName || 'Chat'}</strong>
              </div>

              <div className="chat-thread">
                {selectedConversation.messages.map((message) => (
                  <div
                    key={message.id}
                    className={message.senderId === currentUser.id ? 'bubble outgoing' : 'bubble incoming'}
                  >
                    {message.message}
                  </div>
                ))}
              </div>

              <div className="composer-row">
                <input
                  value={chatDraft}
                  placeholder="Type your message"
                  onChange={(event) => setChatDraft(event.target.value)}
                />
                <button className="primary-button" onClick={onSend}>Send</button>
              </div>
            </div>
          )}
        </div>
      )}
    </main>
  );
}

function ProfileScreen({ currentUser, profilesById, follows, onVerificationSubmit }) {
  const [verificationForm, setVerificationForm] = useState({
    fullName: currentUser.fullName || '',
    socialLinks: {
      instagram: '',
      tiktok: '',
      facebook: '',
      x: '',
    },
  });

  const followerCount = follows.filter((follow) => follow.tipsterId === currentUser.id).length;

  useEffect(() => {
    setVerificationForm({
      fullName: currentUser.fullName || '',
      socialLinks: currentUser.socialLinks || {
        instagram: '',
        tiktok: '',
        facebook: '',
        x: '',
      },
    });
  }, [currentUser]);

  return (
    <main className="page stack">
      <div className="profile-card card">
        <div className="profile-hero">
          <div className="avatar large">{currentUser.avatar}</div>
          <div>
            <div className="name-bar">
              <h3>{currentUser.fullName}</h3>
              {currentUser.isVerified && <span className="verified-badge">✓</span>}
            </div>
            <p>{currentUser.role === 'tipster' ? 'Tipster account' : 'Regular user account'}</p>
          </div>
        </div>

        <div className="stats-grid">
          <div>
            <strong>{followerCount}</strong>
            <span>Followers</span>
          </div>
          <div>
            <strong>{currentUser.role === 'tipster' ? 'Tipster' : 'Member'}</strong>
            <span>Role</span>
          </div>
          <div>
            <strong>{currentUser.phone || 'N/A'}</strong>
            <span>Phone</span>
          </div>
        </div>
      </div>

      {currentUser.role === 'tipster' && (
        <div className="card form-card">
          <div className="section-row compact">
            <div>
              <p className="eyebrow">Verification</p>
              <h4>Blue tick request</h4>
            </div>
            {currentUser.isVerified && <span className="verified-pill">Verified</span>}
          </div>

          <div className="form-stack compact">
            <label>
              Full name
              <input
                value={verificationForm.fullName}
                onChange={(event) => setVerificationForm((prev) => ({ ...prev, fullName: event.target.value }))}
              />
            </label>

            {Object.entries({ instagram: 'Instagram', tiktok: 'TikTok', facebook: 'Facebook', x: 'X / Twitter' }).map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  value={verificationForm.socialLinks[key]}
                  placeholder={`https://${key}.com/your-handle`}
                  onChange={(event) =>
                    setVerificationForm((prev) => ({
                      ...prev,
                      socialLinks: { ...prev.socialLinks, [key]: event.target.value },
                    }))
                  }
                />
              </label>
            ))}

            <button className="primary-button" onClick={() => onVerificationSubmit(verificationForm)}>
              Submit verification
            </button>
          </div>
        </div>
      )}

      {currentUser.isVerified && (
        <div className="card">
          <p className="eyebrow">Socials</p>
          <div className="social-links">
            {Object.entries(currentUser.socialLinks || {}).map(([key, value]) =>
              value ? (
                <a key={key} href={value} target="_blank" rel="noreferrer" className="social-link">
                  {key === 'instagram' ? '◎' : key === 'tiktok' ? '♪' : key === 'facebook' ? 'f' : 'x'}
                </a>
              ) : null,
            )}
          </div>
        </div>
      )}
    </main>
  );
}

function passwordValid(password) {
  return password && password.length >= 6;
}

function createInitials(name) {
  return (name || 'User')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'U';
}

export default App;
