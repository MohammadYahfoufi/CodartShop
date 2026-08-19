import { getSupabaseAdmin } from '@/lib/supabase-server';
import { NextResponse } from 'next/server';

const supabase = getSupabaseAdmin();

export async function GET() {
  try {
    const categories = await supabase.from('categories').select('*');
    return NextResponse.json({ categories });
  } catch (error) {
    console.error('Error fetching categories:', error);
    return NextResponse.json(
      { error: 'Failed to fetch categories' },
      { status: 500 },
    );
  }
}
