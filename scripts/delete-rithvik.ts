import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const RITHVIK = '0x249104cea7f0cfd3d3af95706d22150e8899bdcb';

async function main() {
  // Delete conversation messages where Rithvik is sender
  const { error: e1 } = await supabase.from('conversation_messages').delete().eq('sender_address', RITHVIK);
  console.log('conversation_messages (sender):', e1?.message || 'done');

  // Find conversations involving Rithvik
  const { data: convosA } = await supabase.from('conversations').select('id').eq('user_a_address', RITHVIK);
  const { data: convosB } = await supabase.from('conversations').select('id').eq('user_b_address', RITHVIK);
  const convoIds = [...(convosA || []), ...(convosB || [])].map(c => c.id);
  if (convoIds.length > 0) {
    await supabase.from('conversation_messages').delete().in('conversation_id', convoIds);
    await supabase.from('conversations').delete().in('id', convoIds);
    console.log('conversations deleted:', convoIds.length);
  } else {
    console.log('no conversations found');
  }

  // Delete match votes
  const { error: e2 } = await supabase.from('match_votes').delete().eq('voter_address', RITHVIK);
  console.log('match_votes:', e2?.message || 'done');

  // Delete voter assignments
  const { error: e3 } = await supabase.from('voter_assignments').delete().eq('voter_address', RITHVIK);
  console.log('voter_assignments:', e3?.message || 'done');

  // Delete match proposals involving Rithvik
  const { error: e4a } = await supabase.from('match_proposals').delete().eq('user_a_address', RITHVIK);
  const { error: e4b } = await supabase.from('match_proposals').delete().eq('user_b_address', RITHVIK);
  console.log('match_proposals (a):', e4a?.message || 'done');
  console.log('match_proposals (b):', e4b?.message || 'done');

  // Delete profile
  const { error: e5 } = await supabase.from('profiles').delete().eq('wallet_address', RITHVIK);
  console.log('profile:', e5?.message || 'done');

  console.log('\nRithvik data cleared.');
}

main();
