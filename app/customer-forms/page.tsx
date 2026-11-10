import {CustomerAgreementForm} from '@/src/components/customer-agreement-form';
import './forms.css';

export const metadata={title:'Customer forms | GroomPro',robots:{index:false,follow:false},referrer:'no-referrer' as const};
export default function CustomerFormsPage(){return <CustomerAgreementForm/>;}
