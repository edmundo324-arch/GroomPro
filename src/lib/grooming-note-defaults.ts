import {baseBreeds, Breed, breedKey, findBreed} from './breed-classification';

export type GroomingChoice = 'GR' | 'FFT' | 'FW';
export const groomingChoiceLabels: Record<GroomingChoice,string> = {GR:'Grooming',FFT:'FFT',FW:'Full Wash'};
// Owner-provided assignments, not an inference from weight, coat, or parent breeds.
export const suppliedGroomingBreeds: Record<GroomingChoice,string[]> = {
 GR: `Affenpinscher|Airedale Terrier|Australian Terrier|Bearded Collie|Bichon Frise|Black Russian Terrier|Bouvier des Flandres|Briard|Brussels Griffon|Chinese Crested|Cocker Spaniel (American)|Coton de Tulear|Dandie Dinmont Terrier|Havanese|Irish Terrier|Irish Water Spaniel|Kerry Blue Terrier|Lhasa Apso|Long-Haired Chihuahua|Maltese|Pekingese|Polish Lowland Sheepdog|Pomeranian|Poodle (Miniature)|Poodle (Standard)|Portuguese Water Dog|Shih Tzu|Silky Terrier|Soft Coated Wheaten Terrier|Standard Schnauzer|Toy Poodle|Welsh Terrier|West Highland White Terrier|Wirehaired Pointing Griffon|Yorkshire Terrier`.split('|'),
 FFT: `Alaskan Malamute|American Eskimo Dog (Standard)|American Water Spaniel|Anatolian Shepherd Dog|Belgian Malinois|Belgian Sheepdog|Belgian Tervuren|Bernese Mountain Dog|Border Collie|Brittany|Cavalier King Charles Spaniel|Chesapeake Bay Retriever|Clumber Spaniel|Curly-Coated Retriever|English Springer Spaniel|Finnish Lapphund|Finnish Spitz|German Wirehaired Pointer|Golden Retriever|Gordon Setter|Great Pyrenees|Greater Swiss Mountain Dog|Japanese Chin|Keeshond|Kuvasz|Leonberger|Newfoundland|Norwegian Buhund|Norwegian Elkhound|Otterhound|Papillon|Saint Bernard|Samoyed|Schipperke|Scottish Deerhound|Shiba Inu|Siberian Husky|Spinone Italiano|Sussex Spaniel|Tibetan Mastiff|Tibetan Spaniel|Welsh Springer Spaniel`.split('|'),
 FW: `American Staffordshire Terrier|Australian Cattle Dog|Basenji|Beagle|Black and Tan Coonhound|Bloodhound|Boston Terrier|Boxer|Bull Terrier|Bulldog|Bulldog (American)|Bulldog (English)|Bullmastiff|Cane Corso|Chihuahua|Chinese Shar-Pei|Dachshund (Miniature)|Dachshund (Standard)|Dalmatian|Doberman Pinscher|Dogue de Bordeaux|English Bulldog|English Foxhound|English Mastiff|Entlebucher Mountain Dog|French Bulldog|German Pinscher|German Shorthaired Pointer|Great Dane|Irish Wolfhound|Italian Greyhound|Labrador Retriever|Mastiff|Miniature Pinscher|Neapolitan Mastiff|Parson Russell Terrier|Pharaoh Hound|Pointer|Redbone Coonhound|Rottweiler|Smooth Fox Terrier|Staffordshire Bull Terrier|Swedish Vallhund|Toy Fox Terrier|Toy Manchester Terrier|Vizsla|Weimaraner`.split('|'),
};
const suppliedById = new Map<string,GroomingChoice>();
const suppliedByName = new Map<string,GroomingChoice>();
for(const choice of Object.keys(suppliedGroomingBreeds) as GroomingChoice[]) {
 for(const name of suppliedGroomingBreeds[choice]) {
  suppliedByName.set(breedKey(name),choice);
  const breed=findBreed(name);
  if(breed) suppliedById.set(breed.id,choice);
 }
}
export function breedGroomingDefault(pet:{breedId?:string|null;breed?:string|null}, breeds:Breed[]=baseBreeds):GroomingChoice|null {
 const breed=pet.breedId?breeds.find(b=>b.id===pet.breedId):findBreed(pet.breed||'',breeds);
 if(pet.breedId&&!breed)return null;
 return breed ? suppliedById.get(breed.id) || null : suppliedByName.get(breedKey(pet.breed||'')) || null;
}

export type GroomingInstructions={classification:GroomingChoice|null;body:string;tbf:string;ears:string;tail:string;specialNotes:string};
export function initialGroomingInstructions(pet:{breedId?:string|null;breed?:string|null},usual:GroomingInstructions|null,latest:GroomingInstructions|null,breeds:Breed[]=baseBreeds):GroomingInstructions {
 const previous=usual||latest;
 return previous?{...previous}:{classification:breedGroomingDefault(pet,breeds),body:'',tbf:'',ears:'',tail:'',specialNotes:''};
}
