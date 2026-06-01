import { getCurrentUser } from '../../../../lib/auth/currentUser';
import { json } from '../../../../lib/apiResponse';

export async function GET() {
  const user = await getCurrentUser();
  return json({ user });
}
