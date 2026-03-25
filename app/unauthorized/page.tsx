import { redirect } from 'next/navigation';

export default function UnauthorizedRedirectPage() {
  redirect('/?error=unauthorized');
}
