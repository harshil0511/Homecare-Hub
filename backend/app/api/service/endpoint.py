import os
import uuid
import json
import logging
from datetime import datetime, timedelta
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from typing import List, Optional
from app.internal import deps

logger = logging.getLogger(__name__)
from app.internal.models import User, Society, ServiceProvider, ServiceBooking, BookingReview, ServiceCertificate, SocietyRequest, society_trusted_providers
from app.internal.schemas import (
    SocietyCreate, SocietyResponse, SocietyUpdate,
    ProviderCreate, ProviderResponse, ProviderUpdate, AvailabilityUpdate,
    BookingCreate, BookingUpdate, BookingRead,
    CertificateCreate, CertificateResponse,
    SocietyRequestCreate, SocietyRequestResponse, SocietyRequestAction
)

UPLOAD_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), "uploads", "profile_photos")

router = APIRouter(tags=["Service & Community CRUD API"])

@router.post("/societies", response_model=SocietyResponse)
def create_society(
    society_in: SocietyCreate, 
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    try:
        # Check if a society with same name or registration number already exists
        existing_name = db.query(Society).filter(Society.name == society_in.name).first()
        if existing_name:
            raise HTTPException(status_code=400, detail="An organization with this name already exists.")
        
        if society_in.registration_number:
            existing_reg = db.query(Society).filter(Society.registration_number == society_in.registration_number).first()
            if existing_reg:
                raise HTTPException(status_code=400, detail="This registration number is already in use.")

        db_society = Society(
            **society_in.model_dump(), 
            owner_id=current_user.id if society_in.creator_role == "OWNER" else None,
            secretary_id=current_user.id if society_in.creator_role == "SECRETARY" else None
        )
        db.add(db_society)
        # Flush to get the ID without committing yet
        db.flush()
        
        # Automatically join the creator to the new society
        current_user.society_id = db_society.id
        
        # Commit both changes in one transaction
        db.commit()
        db.refresh(db_society)
        return db_society
    except HTTPException:
        db.rollback()
        raise
    except Exception as e:
        db.rollback()
        logger.error("Error creating society: %s", e)
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/societies", response_model=List[SocietyResponse])
def get_societies(db: Session = Depends(deps.get_db)):
    return db.query(Society).all()

@router.post("/societies/join/{society_id}")
def join_society(
    society_id: int, 
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    society = db.query(Society).filter(Society.id == society_id).first()
    if not society:
        raise HTTPException(status_code=404, detail="Society not found")
    current_user.society_id = society_id
    db.commit()
    return {"message": f"Successfully joined {society.name}"}

@router.get("/societies/me/created", response_model=List[SocietyResponse])
def get_my_created_societies(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    return db.query(Society).filter(
        (Society.owner_id == current_user.id) | 
        (Society.secretary_id == current_user.id)
    ).all()

@router.patch("/societies/{society_id}", response_model=SocietyResponse)
def update_society(
    society_id: int,
    society_in: SocietyUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    society = db.query(Society).filter(Society.id == society_id).first()
    if not society:
        raise HTTPException(status_code=404, detail="Society not found")
    
    # Check permission (only owner or secretary can update)
    if society.owner_id != current_user.id and society.secretary_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to update this society")
    
    update_data = society_in.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(society, field, value)
    
    db.commit()
    db.refresh(society)
    return society

@router.delete("/societies/{society_id}")
def delete_society(
    society_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    society = db.query(Society).filter(Society.id == society_id).first()
    if not society:
        raise HTTPException(status_code=404, detail="Society not found")
    
    # Check permission (only owner or secretary can delete)
    if society.owner_id != current_user.id and society.secretary_id != current_user.id:
        raise HTTPException(status_code=403, detail="Only the owner or secretary can decommission a society")
    
    # Check if this society is currently active for any user and nullify it
    db.query(User).filter(User.society_id == society_id).update({User.society_id: None})
    
    db.delete(society)
    db.commit()
    return {"message": "Society successfully decommissioned"}

# Service Provider Routes
@router.post("/providers", response_model=ProviderResponse)
def register_provider(
    provider_in: ProviderCreate, 
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    existing = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
    if existing:
        raise HTTPException(status_code=400, detail="User already has a provider profile")

    data = provider_in.model_dump()
    # Serialize categories list to JSON string for the Text column
    if data.get("categories") and isinstance(data["categories"], list):
        data["categories"] = json.dumps(data["categories"])

    db_provider = ServiceProvider(
        **data,
        user_id=current_user.id,
        is_verified=False
    )
    db.add(db_provider)
    db.commit()
    db.refresh(db_provider)
    return db_provider

@router.get("/providers", response_model=List[ProviderResponse])
def get_providers(
    category: Optional[str] = None,
    search: Optional[str] = None,
    scheduled_at: Optional[datetime] = None,  # Time-based availability check
    verified_only: bool = False,
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    query = db.query(ServiceProvider)

    if verified_only:
        query = query.filter(ServiceProvider.is_verified == True)

    # Society filtering:
    # - Providers with society_id=NULL are global — always visible to everyone
    # - Providers with a society_id only appear to users in the same society
    # - If the user has no society, they see all providers (global + all societies)
    if current_user.society_id:
        query = query.filter(
            (ServiceProvider.society_id == current_user.society_id) |
            (ServiceProvider.society_id == None)
        )
    # else: no filter → user sees all providers

    if category:
        # Escape LIKE wildcards in user-supplied input to prevent wildcard injection
        escaped_cat = category.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        search_cat = f"%{escaped_cat}%"
        query = query.filter(
            (ServiceProvider.category == category) |
            (ServiceProvider.categories.like(search_cat))
        )

    if search:
        escaped_search = search.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
        search_term = f"%{escaped_search}%"
        query = query.filter(
            (ServiceProvider.company_name.ilike(search_term)) |
            (ServiceProvider.owner_name.ilike(search_term)) |
            (ServiceProvider.first_name.ilike(search_term)) |
            (ServiceProvider.last_name.ilike(search_term)) |
            (ServiceProvider.location.ilike(search_term)) |
            (ServiceProvider.bio.ilike(search_term)) |
            (ServiceProvider.categories.ilike(search_term))
        )

    providers = query.offset(skip).limit(limit).all()

    # Time-based availability: if scheduled_at provided, check for booking conflicts
    if scheduled_at:
        window_start = scheduled_at - timedelta(hours=3)
        window_end = scheduled_at + timedelta(hours=3)
        for provider in providers:
            if provider.availability_status == "VACATION":
                continue  # Respect manual vacation status
            conflict = db.query(ServiceBooking).filter(
                ServiceBooking.provider_id == provider.id,
                ServiceBooking.status.in_(["Pending", "Accepted", "In Progress"]),
                ServiceBooking.scheduled_at >= window_start,
                ServiceBooking.scheduled_at <= window_end
            ).first()
            # Temporarily set computed status (not saved to DB)
            provider.availability_status = "WORKING" if conflict else "AVAILABLE"

    return providers

@router.get("/providers/me", response_model=ProviderResponse)
def get_my_provider_profile(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found. Please complete setup.")
    return provider

@router.get("/providers/me/reviews")
def get_my_reviews(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    reviews = (
        db.query(BookingReview, ServiceBooking.service_type, User.first_name, User.last_name)
        .join(ServiceBooking, ServiceBooking.id == BookingReview.booking_id)
        .join(User, User.id == ServiceBooking.user_id)
        .filter(ServiceBooking.provider_id == provider.id)
        .order_by(BookingReview.created_at.desc())
        .all()
    )
    return [
        {
            "id": r.id,
            "rating": r.rating,
            "review_text": r.review_text,
            "quality_rating": r.quality_rating,
            "punctuality_rating": r.punctuality_rating,
            "professionalism_rating": r.professionalism_rating,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "service_type": service_type,
            "user_name": f"{first_name or ''} {last_name or ''}".strip() or "Anonymous"
        }
        for r, service_type, first_name, last_name in reviews
    ]

@router.post("/providers/setup", response_model=ProviderResponse)
def setup_professional_profile(
    profile_in: ProviderUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
    if not provider:
        # Create a basic profile if it doesn't exist
        provider = ServiceProvider(
            user_id=current_user.id,
            company_name=f"{current_user.username}'s Services",
            owner_name=current_user.username,
            email=current_user.email,
            phone="Not Provided",
            category="General"
        )
        db.add(provider)

    update_data = profile_in.model_dump(exclude_unset=True)

    # Handle categories list serialization
    if "categories" in update_data and update_data["categories"] is not None:
        provider.categories = json.dumps(update_data["categories"])
        # Set main category to the first one if not set
        if update_data["categories"]:
            provider.category = update_data["categories"][0]
        del update_data["categories"]

    for field, value in update_data.items():
        setattr(provider, field, value)

    # Update company_name based on first/last name
    if provider.first_name and provider.last_name:
        provider.company_name = f"{provider.first_name} {provider.last_name}"
        provider.owner_name = f"{provider.first_name} {provider.last_name}"

    db.commit()
    db.refresh(provider)
    return provider

@router.post("/providers/upload-photo")
async def upload_profile_photo(
    file: UploadFile = File(...),
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    allowed_types = ["image/jpeg", "image/png", "image/webp"]
    if file.content_type not in allowed_types:
        raise HTTPException(status_code=400, detail="Only JPEG, PNG, and WebP images are allowed")

    contents = await file.read()
    if len(contents) > 5 * 1024 * 1024:
        raise HTTPException(status_code=400, detail="File too large. Maximum size is 5MB")

    os.makedirs(UPLOAD_DIR, exist_ok=True)
    ext = file.filename.rsplit(".", 1)[-1] if file.filename and "." in file.filename else "jpg"
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = os.path.join(UPLOAD_DIR, filename)
    with open(filepath, "wb") as f:
        f.write(contents)

    photo_url = f"/uploads/profile_photos/{filename}"

    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
    if provider:
        provider.profile_photo_url = photo_url
        db.commit()

    return {"url": photo_url}

@router.post("/providers/certificates", response_model=CertificateResponse)
def upload_certificate(
    cert_in: CertificateCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    db_cert = ServiceCertificate(
        **cert_in.model_dump(),
        provider_id=provider.id
    )
    db.add(db_cert)
    db.commit()
    db.refresh(db_cert)
    return db_cert

@router.patch("/providers/me", response_model=ProviderResponse)
def update_provider_profile(
    provider_in: ProviderUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    update_data = provider_in.model_dump(exclude_unset=True)

    # Handle categories list serialization
    if "categories" in update_data and update_data["categories"] is not None:
        provider.categories = json.dumps(update_data["categories"])
        if update_data["categories"]:
            provider.category = update_data["categories"][0]
        del update_data["categories"]

    for field, value in update_data.items():
        setattr(provider, field, value)

    # Keep company_name in sync with name
    if provider.first_name and provider.last_name:
        provider.company_name = f"{provider.first_name} {provider.last_name}"
        provider.owner_name = f"{provider.first_name} {provider.last_name}"

    db.commit()
    db.refresh(provider)
    return provider

@router.patch("/providers/availability", response_model=ProviderResponse)
def toggle_availability(
    availability_in: AvailabilityUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
    
    provider.availability_status = availability_in.status
    db.commit()
    db.refresh(provider)
    return provider

# --- Organization & recruitment logic ---

@router.get("/societies/{society_id}/find-nearest", response_model=List[ProviderResponse])
def find_nearest_providers(
    society_id: int,
    category: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    society = db.query(Society).filter(Society.id == society_id).first()
    if not society:
        raise HTTPException(status_code=404, detail="Society not found")
    
    # Simple location matching based on society address/city
    query = db.query(ServiceProvider)
    if society.address:
        # Match city or part of address
        city = society.address.split(",")[-1].strip()
        query = query.filter(ServiceProvider.location.ilike(f"%{city}%"))
    
    if category:
        query = query.filter(ServiceProvider.category == category)
        
    return query.limit(20).all()

@router.post("/societies/{society_id}/recruit/{provider_id}", response_model=SocietyRequestResponse)
def recruit_provider(
    society_id: int,
    provider_id: int,
    message: Optional[str] = None,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    society = db.query(Society).filter(Society.id == society_id).first()
    if not society:
        raise HTTPException(status_code=404, detail="Society not found")
    
    # Check authority (Owner or Secretary)
    if current_user.id != society.owner_id and current_user.id != society.secretary_id:
        raise HTTPException(status_code=403, detail="Only the society owner or secretary can recruit providers")
    
    # Check if a request already exists
    existing = db.query(SocietyRequest).filter(
        SocietyRequest.society_id == society_id,
        SocietyRequest.provider_id == provider_id,
        SocietyRequest.status == "PENDING"
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="A recruitment request is already pending for this provider")
    
    db_request = SocietyRequest(
        society_id=society_id,
        provider_id=provider_id,
        sender_id=current_user.id,
        message=message
    )
    db.add(db_request)
    db.commit()
    db.refresh(db_request)
    return db_request

@router.get("/providers/invitations", response_model=List[SocietyRequestResponse])
def get_provider_invitations(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")
        
    return db.query(SocietyRequest).filter(SocietyRequest.provider_id == provider.id, SocietyRequest.status == "PENDING").all()

@router.get("/societies/{society_id}/requests", response_model=List[SocietyRequestResponse])
def get_society_sent_requests(
    society_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    society = db.query(Society).filter(Society.id == society_id).first()
    if not society:
        raise HTTPException(status_code=404, detail="Society not found")
    
    if current_user.id != society.owner_id and current_user.id != society.secretary_id:
        raise HTTPException(status_code=403, detail="Not authorized to view society requests")
        
    return db.query(SocietyRequest).filter(SocietyRequest.society_id == society_id, SocietyRequest.status == "PENDING").all()

# Recruitment & Invitation Logic
@router.post("/societies/request", response_model=SocietyRequestResponse)
def send_society_invitation(
    request_in: SocietyRequestCreate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    society = db.query(Society).filter(Society.id == request_in.society_id).first()
    if not society:
        raise HTTPException(status_code=404, detail="Society not found")
    
    # Only Secretary or Owner can invite
    if current_user.id != society.secretary_id and current_user.id != society.owner_id:
        raise HTTPException(status_code=403, detail="Only society officials can invite providers")
    
    # Check if a request already exists
    existing = db.query(SocietyRequest).filter(
        SocietyRequest.society_id == request_in.society_id,
        SocietyRequest.provider_id == request_in.provider_id,
        SocietyRequest.status == "PENDING"
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail="An invitation is already pending for this provider")

    db_request = SocietyRequest(
        **request_in.model_dump(),
        sender_id=current_user.id,
        status="PENDING"
    )
    db.add(db_request)
    db.commit()
    db.refresh(db_request)
    return db_request

@router.get("/societies/requests/me", response_model=List[SocietyRequestResponse])
def get_my_society_requests(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
    if not provider:
        return [] # User is not a provider
        
    return db.query(SocietyRequest).filter(SocietyRequest.provider_id == provider.id, SocietyRequest.status == "PENDING").all()

@router.post("/societies/requests/{request_id}/action", response_model=SocietyRequestResponse)
def handle_society_request(
    request_id: int,
    action: SocietyRequestAction,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    request = db.query(SocietyRequest).filter(SocietyRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Request not found")
    
    provider = db.query(ServiceProvider).filter(ServiceProvider.id == request.provider_id).first()
    if not provider or provider.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized to respond to this request")
    
    request.status = action.status.upper()
    
    if request.status == "ACCEPTED":
        society = db.query(Society).filter(Society.id == request.society_id).first()
        # Update provider's society_id to link them
        provider.society_id = society.id
        # Also add to trusted list
        if provider not in society.trusted_providers:
            society.trusted_providers.append(provider)
            
    db.commit()
    db.refresh(request)
    return request

# Trusted Provider Logic
@router.post("/societies/{society_id}/trust/{provider_id}")
def add_trusted_provider(
    society_id: int,
    provider_id: int,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    society = db.query(Society).filter(Society.id == society_id).first()
    if not society:
        raise HTTPException(status_code=404, detail="Society not found")
    
    # Only Secretary or Owner can manage trust
    if current_user.id != society.secretary_id and current_user.id != society.owner_id:
        raise HTTPException(status_code=403, detail="Only the society secretary can trust providers")
    
    provider = db.query(ServiceProvider).filter(ServiceProvider.id == provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
    
    if provider not in society.trusted_providers:
        society.trusted_providers.append(provider)
        db.commit()
    
    return {"message": f"Successfully trusted {provider.company_name}"}

@router.get("/societies/{society_id}/trusted", response_model=List[ProviderResponse])
def get_trusted_providers(
    society_id: int,
    db: Session = Depends(deps.get_db)
):
    society = db.query(Society).filter(Society.id == society_id).first()
    if not society:
        raise HTTPException(status_code=404, detail="Society not found")
    
    return society.trusted_providers

# Booking Routes
@router.post("/bookings", response_model=BookingRead)
def create_booking(
    booking_in: BookingCreate, 
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    provider = db.query(ServiceProvider).filter(ServiceProvider.id == booking_in.provider_id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider not found")
        
    db_booking = ServiceBooking(
        **booking_in.model_dump(),
        user_id=current_user.id
    )
    db.add(db_booking)
    db.commit()
    db.refresh(db_booking)
    return db_booking

@router.get("/bookings", response_model=List[BookingRead])
def get_user_bookings(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    return db.query(ServiceBooking).filter(ServiceBooking.user_id == current_user.id).order_by(ServiceBooking.id.desc()).offset(skip).limit(limit).all()

@router.get("/bookings/incoming", response_model=List[BookingRead])
def get_incoming_bookings(
    skip: int = 0,
    limit: int = 50,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    # Get the provider profile associated with the current user
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    return db.query(ServiceBooking).filter(ServiceBooking.provider_id == provider.id).order_by(ServiceBooking.id.desc()).offset(skip).limit(limit).all()

@router.patch("/bookings/{booking_id}", response_model=BookingRead)
def update_booking_status(
    booking_id: int,
    booking_update: BookingUpdate,
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    booking = db.query(ServiceBooking).filter(ServiceBooking.id == booking_id).first()
    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    # Only the provider or the user who created it can update status?
    # Usually provider accepts/completes, and user cancels.
    provider = db.query(ServiceProvider).filter(ServiceProvider.id == booking.provider_id).first()
    
    is_provider = provider and provider.user_id == current_user.id
    is_owner = booking.user_id == current_user.id
    
    if not is_provider and not is_owner:
        raise HTTPException(status_code=403, detail="Not authorized to update this booking")

    update_data = booking_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(booking, field, value)

    db.commit()
    db.refresh(booking)
    return booking

@router.post("/providers/verify")
def submit_verification(
    db: Session = Depends(deps.get_db),
    current_user: User = Depends(deps.get_current_user)
):
    provider = db.query(ServiceProvider).filter(ServiceProvider.user_id == current_user.id).first()
    if not provider:
        raise HTTPException(status_code=404, detail="Provider profile not found")

    # Certificate-based verification: provider must have at least one uploaded certificate
    cert_count = db.query(ServiceCertificate).filter(
        ServiceCertificate.provider_id == provider.id,
        ServiceCertificate.certificate_url != None
    ).count()

    if cert_count >= 1:
        provider.is_verified = True
        db.commit()
        return {"message": "Verification successful. You are now a Verified Expert.", "verified": True}
    else:
        return {"message": "Upload at least one certificate to get verified.", "verified": False}
