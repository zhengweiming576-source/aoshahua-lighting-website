import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './styles.css';
import { applyContent } from './data';
import { supabase } from './lib/supabase';

function SiteRoot() {
  const [, refresh] = React.useState(0);

  React.useEffect(() => {
    let active = true;
    (async () => {
      if (!supabase) return;
      const { data } = await supabase.from('site_content').select('content').eq('id', 'main').maybeSingle();
      if (!active || !data?.content) return;
      applyContent(data.content);
      refresh((value) => value + 1);
    })();
    return () => { active = false; };
  }, []);

  return <App />;
}

createRoot(document.getElementById('root')).render(<SiteRoot />);
