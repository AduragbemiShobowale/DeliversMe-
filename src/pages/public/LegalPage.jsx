const DOCS = {
  privacy: {
    title: 'Privacy Policy',
    sections: [
      ['What we collect', 'Account details you provide (name, email, phone), business and rider profile details, delivery records (addresses, recipient name and phone, item description), delivery photos taken as proof, and — for riders who are online — approximate location.'],
      ['How we use it', 'Only to operate deliveries: connecting customers, businesses and riders, showing delivery status, sending in-app notifications and keeping the platform safe.'],
      ['Who can see it', 'Access is enforced by database rules. A delivery is visible only to the requesting customer, the business, the assigned rider and administrators. Proof-of-delivery photos are stored privately. Riders’ names and phone numbers are visible to businesses so jobs can be offered.'],
      ['Your choices', 'You can edit your profile and notification preferences in Settings, and ask us to delete your account through the Contact page.'],
      ['Status of this document', 'This is a working policy for a proof-of-concept application and must be reviewed by a qualified professional (including against the Nigeria Data Protection Act 2023) before commercial use.'],
    ],
  },
  terms: {
    title: 'Terms of Service',
    sections: [
      ['Using DeliverSME', 'You must give accurate information, keep your password secure and use the platform only for lawful deliveries.'],
      ['Businesses', 'Businesses are responsible for the goods they send, for accurate delivery details and for the riders they choose to offer jobs to.'],
      ['Riders', 'Riders must be verified before receiving jobs, handle packages with care and update delivery status honestly. Proof of delivery must reflect the real handover.'],
      ['Customers', 'Requests may be accepted or declined by the business. Deliveries can be cancelled until a rider accepts them.'],
      ['Accounts', 'Administrators may suspend accounts that break these terms.'],
      ['Status of this document', 'These terms accompany a proof-of-concept application and require legal review before commercial use.'],
    ],
  },
};

export default function LegalPage({ kind }) {
  const d = DOCS[kind];
  return (
    <article className="mx-auto max-w-3xl px-4 py-14 sm:px-6">
      <h1 className="text-3xl font-extrabold text-navy-900 sm:text-4xl">{d.title}</h1>
      {d.sections.map(([h, t]) => (
        <section key={h} className="mt-8"><h2 className="text-lg font-semibold text-navy-900">{h}</h2><p className="mt-2 leading-relaxed text-slate-600">{t}</p></section>
      ))}
    </article>
  );
}
