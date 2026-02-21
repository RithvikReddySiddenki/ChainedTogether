import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

const FAKE_WALLETS: Record<string, string> = {
  emma:   '0xf000000000000000000000000000000000000001',
  liam:   '0xf000000000000000000000000000000000000002',
  olivia: '0xf000000000000000000000000000000000000003',
  noah:   '0xf000000000000000000000000000000000000004',
  ava:    '0xf000000000000000000000000000000000000005',
  ethan:  '0xf000000000000000000000000000000000000006',
  mia:    '0xf000000000000000000000000000000000000007',
  lucas:  '0xf000000000000000000000000000000000000008',
  sophia: '0xf000000000000000000000000000000000000009',
  james:  '0xf00000000000000000000000000000000000000a',
};

// Real portrait photos from randomuser.me (stable URLs)
const photos: Record<string, string> = {
  emma:   'https://randomuser.me/api/portraits/women/44.jpg',
  liam:   'https://randomuser.me/api/portraits/men/32.jpg',
  olivia: 'https://randomuser.me/api/portraits/women/68.jpg',
  noah:   'https://randomuser.me/api/portraits/men/75.jpg',
  ava:    'https://randomuser.me/api/portraits/women/17.jpg',
  ethan:  'https://randomuser.me/api/portraits/men/86.jpg',
  mia:    'https://randomuser.me/api/portraits/women/90.jpg',
  lucas:  'https://randomuser.me/api/portraits/men/11.jpg',
  sophia: 'https://randomuser.me/api/portraits/women/55.jpg',
  james:  'https://randomuser.me/api/portraits/men/94.jpg',
};

async function main() {
  console.log('Updating fake profiles with real photos...\n');

  for (const [name, wallet] of Object.entries(FAKE_WALLETS)) {
    const url = photos[name];
    const { error } = await supabase
      .from('profiles')
      .update({ image_url: url })
      .eq('wallet_address', wallet);

    if (error) {
      console.error(`  ${name}: ERROR - ${error.message}`);
    } else {
      console.log(`  ${name}: updated`);
    }
  }

  console.log('\nDone!');
}

main();
