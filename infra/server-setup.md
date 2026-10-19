# Lightsail sunucu kurulumu (bir kez)

## 1. Sunucu (konsol: lightsail.aws.amazon.com)
- Create instance → Region **Frankfurt (eu-central-1)**, zone `eu-central-1a`
- Platform Linux/Unix → OS Only → **Ubuntu 24.04 LTS**
- Plan: **12 USD/ay** (2 GB RAM, 2 vCPU, 60 GB SSD, 3 TB transfer, IPv4'lü)
- SSH anahtar çifti: kendi `~/.ssh/id_ed25519.pub`'ını yükle
- Ad: `seker-1`
- Oluşunca: Networking → **Create static IP** → `seker-1`'e bağla (bağlıyken ücretsiz)
- Networking → IPv4 Firewall: yalnızca SSH 22, HTTP 80, HTTPS 443 (TCP) ve 443 (UDP, HTTP/3). IPv6 Firewall: aynı.
- Snapshots → **Enable automatic snapshots** (günlük, son 7'si tutulur; depolama ücreti GB başına ayrıca).

Supabase projesinin bölgesini kontrol et (Supabase → Project Settings → General → Region).
`eu-central-1` değilse sunucuyu o bölgeye en yakın Lightsail bölgesinde aç.

## 2. İlk bağlantı ve sertleştirme
    ssh ubuntu@<static-ip>
    sudo apt update && sudo apt -y full-upgrade
    sudo apt -y install unattended-upgrades fail2ban
    sudo dpkg-reconfigure -f noninteractive unattended-upgrades
    printf 'PasswordAuthentication no\nPermitRootLogin no\n' | sudo tee /etc/ssh/sshd_config.d/00-hardening.conf
    sudo sshd -t
    sudo systemctl restart ssh
    sudo sshd -T | grep -Ei '^(passwordauthentication|permitrootlogin) '   # ikisi de "no" olmalı
    sudo timedatectl set-timezone Europe/Istanbul

## 3. Swap (2 GB)
    sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
    sudo mkswap /swapfile && sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    free -h

## 4. Docker ve deploy kullanıcısı
    curl -fsSL https://get.docker.com | sudo sh
    sudo useradd -m -s /bin/bash -G docker deploy
    sudo mkdir -p /home/deploy/.ssh /opt/seker
    # Yerelde: ssh-keygen -t ed25519 -f ~/.ssh/seker_deploy -N "" ; açık anahtarı aşağıya yapıştır
    echo "<~/.ssh/seker_deploy.pub içeriği>" | sudo tee /home/deploy/.ssh/authorized_keys
    sudo chown -R deploy:deploy /home/deploy/.ssh /opt/seker
    sudo chmod 700 /home/deploy/.ssh && sudo chmod 600 /home/deploy/.ssh/authorized_keys

Not: Lightsail güvenlik duvarı yeterli; ufw kullanılmıyor çünkü Docker yayınladığı portlarda ufw kurallarını zaten atlar.

## 5. GHCR erişimi (private imajlar)
GitHub → Settings → Developer settings → Personal access tokens (classic) → yalnızca `read:packages`.
    sudo -iu deploy
    echo "<token>" | docker login ghcr.io -u meertseker --password-stdin

## 6. Ortam dosyası
    cd /opt/seker
    nano .env      # infra/env.example'daki tüm anahtarlar, gerçek değerlerle
    chmod 600 .env
`SUPABASE_DB_URL`: Supabase → Connect → **Session pooler** bağlantı dizesi (IPv4; doğrudan bağlantı yalnızca IPv6'dır).
`CRON_SECRET`: `openssl rand -hex 32`.
`IMAGE_TAG`: ilk dağıtımda boş bırak; deploy.sh doldurur.
`.env` değerlerinde `$` varsa değeri tek tırnak içine al (`KEY='değer'`); değer `'` içeremez.

## 7. WhatsApp grubu (WAHA)
Panel işlemleri okulun WhatsApp grubuna `waha` konteyneri üzerinden gider. Konteyner yalnızca iç ağdadır, dışarıya port açılmaz.
    cd /opt/seker
    echo "WAHA_URL=http://waha:3000" >> .env
    echo "WAHA_API_KEY=$(openssl rand -hex 32)" >> .env
    docker compose up -d waha panel
Sonra panelde **Ayarlar › WhatsApp grubu**:
1. "Bağlan (QR göster)" → telefonda WhatsApp Business › Bağlı cihazlar › Cihaz bağla → QR'ı okut.
2. "Grupları getir" → grubu seç → Kaydet → "Test mesajı gönder".
3. "Panel işlemlerini gruba gönder" kutusunu işaretle.
Oturum `waha_sessions` volume'unda kalır; konteyner yeniden başlasa da QR tekrar istenmez. Telefon ~14 gün hiç internete çıkmazsa bağlı cihaz düşer; panel yöneticiye bildirim gönderir, QR yeniden okutulur.
