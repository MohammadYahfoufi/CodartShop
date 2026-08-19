
import { getSupabaseAdmin } from '@/lib/supabase-server';
import { getStorefrontSettings } from '@/lib/storefront-settings';

function shouldQueryProducts(message: string) {
  return /\b(products?|items?|catalog|prices?)\b/i.test(message);
}

function shouldQueryCategories(message: string) {
  return /\b(categories?|category|groups?)\b/i.test(message);
}

function shouldQueryStorefrontSettings(message: string) {
  return /\b(contact|help|support|hours|location|store|about|whatsapp|phone|email|address|shipping|delivery|return|refund)\b/i.test(
    message,
  );
}

export async function getToolContext(message: string) {
  const tasks: string[] = [];
  const lowerMessage = message.toLowerCase();
  const hasSupportIntent = shouldQueryStorefrontSettings(message);
  const hasProductIntent = shouldQueryProducts(message);
  const hasCategoryIntent = shouldQueryCategories(message);

  if (hasSupportIntent) tasks.push('storefront_settings');
  if (!hasSupportIntent && hasProductIntent) tasks.push('products');
  if (!hasSupportIntent && hasCategoryIntent) tasks.push('categories');
  if (!hasSupportIntent && !hasProductIntent && !hasCategoryIntent && /\border\b/i.test(lowerMessage)) {
    tasks.push('storefront_settings');
  }

  if (tasks.length === 0) {
    return [];
  }

  const results: Array<{ source: string; data: unknown }> = [];
  const supabase = getSupabaseAdmin();

  if (tasks.includes('products')) {
    const { data, error } = await supabase
      .from('products')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(12);

    if (error) {
      throw error;
    }

    results.push({ source: 'supabase-products', data: data ?? [] });
  }

  if (tasks.includes('categories')) {
    const { data, error } = await supabase
      .from('products')
      .select('category')
      .not('category', 'is', null);

    if (error) {
      throw error;
    }

    results.push({
      source: 'supabase-categories',
      data: {
        categories: [...new Set((data ?? []).map((row) => String(row.category)).filter(Boolean))].sort(),
      },
    });
  }

  if (tasks.includes('storefront_settings')) {
    const settings = await getStorefrontSettings();
    results.push({
      source: 'storefront-settings',
      data: {
        site_name: settings.site_name,
        header_contact_label: settings.header_contact_label,
        footer_contact_eyebrow: settings.footer_contact_eyebrow,
        footer_contact_title: settings.footer_contact_title,
        footer_contact_body: settings.footer_contact_body,
        footer_whatsapp_label: settings.footer_whatsapp_label,
        whatsapp_number: settings.whatsapp_number,
        footer_track_label: settings.footer_track_label,
        footer_story_label: settings.footer_story_label,
        footer_shop_label: settings.footer_shop_label,
        footer_saved_label: settings.footer_saved_label,
        footer_copyright: settings.footer_copyright,
      },
    });
  }

  return results;
}
