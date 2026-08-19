import { getSupabaseAdmin } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

const supabase = getSupabaseAdmin();

export async function GET() {
  try {
    const products = await supabase.from('products').select('*');
    console.log({ products });
    return NextResponse.json({ products });
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json(
      { error: 'Failed to fetch products' },
      { status: 500 },
    );
  }
}
