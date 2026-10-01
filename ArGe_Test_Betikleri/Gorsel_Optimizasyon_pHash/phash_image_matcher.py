import os
import sys
from PIL import Image
import imagehash

VALID_EXTENSIONS = {".jpg", ".jpeg", ".png", ".webp"}

def get_image_files(directory: str) -> list[str]:
    return [
        os.path.join(directory, f)
        for f in os.listdir(directory)
        if os.path.splitext(f)[1].lower() in VALID_EXTENSIONS
    ]

def scan_directory_for_duplicates(directory: str, threshold: int = 5):
    images = get_image_files(directory)
    if not images:
        print(f"Klasorde ({directory}) gecerli gorsel bulunamadi.")
        return

    print(f"Toplam {len(images)} gorsel icin pHash parmak izi cikariliyor...")
    
    hash_db: dict[str, imagehash.ImageHash] = {}
    for img_path in images:
        try:
            with Image.open(img_path) as img:
                hash_db[img_path] = imagehash.phash(img)
        except Exception as err:
            print(f"I/O Hatasi ({os.path.basename(img_path)}): {err}")

    # Not: Kucuk veri setleri icin O(N^2) karsilastirma yeterlidir.
    # Buyuk olcekli sistemlerde BK-Tree veri yapisi tercih edilmelidir.
    visited: set[str] = set()
    duplicate_groups: list[list[str]] = []

    for img1, hash1 in hash_db.items():
        if img1 in visited:
            continue
            
        group = [img1]
        visited.add(img1)
        
        for img2, hash2 in hash_db.items():
            if img2 not in visited:
                # Hamming mesafesi <= threshold olanlar gorsel ikiz kabul edilir
                if hash1 - hash2 <= threshold:
                    group.append(img2)
                    visited.add(img2)
        
        if len(group) > 1:
            duplicate_groups.append(group)

    print("\n" + "=" * 45)
    print("PHASH BENZERLIK ANALIZI")
    print("=" * 45)
    if not duplicate_groups:
        print("Esik degerin altinda benzer gorsel tespit edilmedi.")
    else:
        print(f"Tespit edilen benzerlik kumesi sayisi: {len(duplicate_groups)}\n")
        for idx, grp in enumerate(duplicate_groups, start=1):
            print(f"Kume #{idx}:")
            for path in grp:
                print(f"  -> {os.path.basename(path)}")
            print()

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Kullanim: python phash_image_matcher.py <klasor_yolu>")
        sys.exit(1)
    
    target = sys.argv[1]
    if not os.path.isdir(target):
        print(f"Hata: '{target}' gecerli bir dizin degil.")
        sys.exit(1)
        
    scan_directory_for_duplicates(target)