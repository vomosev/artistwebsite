import AdminDashboard from '../../components/AdminDashboard';

export const metadata = {
  title: 'Portfolio Management',
  description: 'Secure portfolio management area.',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
};

export default function AdminPage() {
  return <AdminDashboard />;
}