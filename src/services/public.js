import { supabase } from '@/lib/supabase';

export async function sendContactMessage(values) {
  // No .select(): visitors may insert but never read messages back.
  const { error } = await supabase.from('contact_messages').insert({
    full_name: values.full_name.trim(),
    email: values.email.trim(),
    subject: values.subject,
    message: values.message.trim(),
  });
  if (error) throw error;
}

export async function subscribeNewsletter(email) {
  const { error } = await supabase.from('newsletter_subscribers').insert({ email: email.trim().toLowerCase() });
  if (error && error.code !== '23505') throw error; // already subscribed is fine
}
