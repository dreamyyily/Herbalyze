from app import app, db, User

with app.app_context():
    users = User.query.all()
    print(f"Mengosongkan wallet address dari {len(users)} akun untuk reset sesi testing.")
    for u in users:
        u.wallet_address = None
        u.role = 'Approved' # Make sure all have Approved status just in case
    db.session.commit()
    print("Selesai dikosongkan.")
