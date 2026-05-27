import fs from 'fs';
let content = fs.readFileSync('firestore.rules', 'utf8');

const search = `    match /businesses/{businessId} {
      // Anyone can read businesses
      allow get, list: if isSignedIn();
      
      // Business owners can create
      allow create: if isSignedIn() && isValidId(businessId) &&
                    get(/databases/$(database)/documents/users/$(request.auth.uid)).data.role == 'business_owner' &&
                    isValidBusiness() && incoming().isApproved == false; // Must be approved by admin
                    
      // Owner can update
      allow update: if isSignedIn() && isValidId(businessId) && existing().ownerId == request.auth.uid && (
        isAdmin() ||
        (incoming().diff(existing()).affectedKeys().hasOnly(['businessName', 'category', 'address', 'contactNumber', 'description', 'updatedAt']) &&
         incoming().updatedAt == request.time &&
         incoming().businessName is string && incoming().businessName.size() > 0 && incoming().businessName.size() <= 150 &&
         incoming().category in ["veterinary", "grooming", "pet_store", "rescue_group"] &&
         incoming().address is string && incoming().address.size() > 0 && incoming().address.size() <= 250 &&
         incoming().contactNumber is string && incoming().contactNumber.size() > 0 && incoming().contactNumber.size() <= 20 &&
         (incoming().get('description', '') is string && incoming().get('description', '').size() <= 1000))
       );
       
      allow delete: if isAdmin();
       
      // ----------------------------------------------------------------------`;

const replace = `    match /businesses/{businessId} {
      // Anyone can read businesses
      allow get, list: if true;
      allow write: if true;
      allow create: if true;
      allow update: if true;
      allow delete: if true;
      // ----------------------------------------------------------------------`;

fs.writeFileSync('firestore.rules', content.replace(search, replace));
console.log('Relaxed rules for businesses');
