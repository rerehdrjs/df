// 날짜와 브라우저 저장소를 사용하는 로컬 데모 상태
const tomorrow = new Date();
tomorrow.setDate(tomorrow.getDate() + 1);
const sampleDeparture = `${tomorrow.getFullYear()}-${String(tomorrow.getMonth() + 1).padStart(2, '0')}-${String(tomorrow.getDate()).padStart(2, '0')}`;
const STORAGE_KEY = 'hitchone-demo-v1';
let koreanHolidayCalendar = null;
let holidayCalendarPromise = null;
let pricingCheckSequence = 0;

function escapeHTML(value) {
    return String(value ?? '').replace(/[&<>"']/g, char => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
    })[char]);
}

function formatDateTime(value) {
    if (!value) return '';
    const date = new Date(String(value).replace(' ', 'T'));
    if (Number.isNaN(date.getTime())) return String(value).replace('T', ' ');
    return new Intl.DateTimeFormat('ko-KR', { month: '2-digit', day: '2-digit', weekday: 'short', hour: '2-digit', minute: '2-digit', hour12: false }).format(date);
}

// 전역 상태 관리
let state = {
    currentTab: 'feed',
    activeChatId: 1,
    selectedRideId: null,
    
    // 내 프로필 정보
    user: {
        name: "김히치",
        profileImg: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150",
        phone: "010-****-5678",
        mannerTemp: 38.2,
        isDriver: true,
        vehicle: { model: '', color: '', plate: '' }
    },

    mannerTags: [
        { label: "⏰ 약속 시간을 잘 지켜요", count: 12 },
        { label: "🚘 차량이 깨끗하고 쾌적해요", count: 9 },
        { label: "💬 대화가 친절하고 매너있어요", count: 8 },
        { label: "🎵 음악/BGM 취향이 편안해요", count: 5 },
        { label: "🛣️ 안전 운전해요", count: 11 }
    ],

    reviews: [
        {
            id: 1,
            evaluatorName: "박동승",
            evaluatorImg: "https://images.unsplash.com/photo-1570295999919-56ceb5ecca61?w=100",
            score: 5.0,
            route: "서울 ➔ 부산",
            date: "2026-09-20",
            tags: ["⏰ 약속 엄수", "💬 친절함", "🚘 차가 깨끗함"],
            comment: "출발 시간보다 일찍 오셔서 기다려주시고, 휴게소 들를 때도 편하게 배려해주셨습니다! 덕분에 부산까지 아주 편안하게 갔어요."
        },
        {
            id: 2,
            evaluatorName: "최영희",
            evaluatorImg: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100",
            score: 5.0,
            route: "대전 ➔ 광주",
            date: "2026-09-12",
            tags: ["🛣️ 안전 운전", "🎵 편안한 분위기"],
            comment: "운전 스킬이 정말 부드러우세요. 중간에 주신 간식도 감사합니다. 다음 장거리 이동할 때 또 이용하고 싶네요!"
        }
    ],

    // 더미 경로 데이터 (위도, 경도 좌표 포함)
    rides: [
        {
            id: 1,
            driverName: "김철수",
            driverImg: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100",
            mannerTemp: 37.5,
            origin: "서울 서초구",
            originCoords: { lat: 37.4837, lng: 127.0324 },
            destination: "부산 해운대구",
            destCoords: { lat: 35.1631, lng: 129.1636 },
            waypoints: ["대전 복합터미널"],
            waypointCoords: [{ name: "대전 복합터미널", lat: 36.3578, lng: 127.4378 }],
            departureTime: `${sampleDeparture} 08:00`,
            seatsLeft: 2,
            totalSeats: 3,
            price: 20000,
            isFemaleOnly: false,
            tags: ["금연", "대형캐리어"],
            carInfo: "하얀색 아반떼 (12가 3456)"
        },
        {
            id: 2,
            driverName: "이영희",
            driverImg: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100",
            mannerTemp: 41.2,
            origin: "대전 서구",
            originCoords: { lat: 36.3504, lng: 127.3845 },
            destination: "광주 북구",
            destCoords: { lat: 35.1747, lng: 126.9122 },
            waypoints: [],
            waypointCoords: [],
            departureTime: `${sampleDeparture} 14:00`,
            seatsLeft: 1,
            totalSeats: 4,
            price: 0,
            isFemaleOnly: true,
            tags: ["여성전용", "금연", "반려동물"],
            carInfo: "검은색 모델3 (56나 7890)"
        }
    ],

    chats: [
        {
            id: 1,
            userId: 101,
            userName: "김철수 (운전자)",
            userImg: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100",
            mannerTemp: 37.5,
            routeInfo: `서울 서초구 ➔ 부산 해운대구 (${sampleDeparture.slice(5).replace('-', '/')})`,
            messages: [
                { sender: "other", text: `안녕하세요! ${sampleDeparture.slice(5).replace('-', '/')} 부산행 카풀 신청해주셨네요.`, time: "오전 10:14" },
                { sender: "mine", text: "네 안녕하세요! 캐리어 하나 있는데 실을 수 있을까요?", time: "오전 10:15" }
            ]
        }
    ]
};

try {
    const savedState = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (savedState.user && typeof savedState.user === 'object') {
        const savedVehicle = savedState.user.vehicle && typeof savedState.user.vehicle === 'object' ? savedState.user.vehicle : {};
        state.user = { ...state.user, ...savedState.user, vehicle: { ...state.user.vehicle, ...savedVehicle } };
    }
    if (Array.isArray(savedState.rides)) state.rides = savedState.rides;
    if (Array.isArray(savedState.chats)) state.chats = savedState.chats;
} catch (error) {
    console.warn('저장된 데모 데이터를 불러오지 못했습니다.', error);
}

function saveState() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({ user: state.user, rides: state.rides, chats: state.chats }));
    } catch (error) {
        console.warn('데모 데이터를 저장하지 못했습니다.', error);
    }
}

function getVehicleInfo(user = state.user) {
    const vehicle = user.vehicle || {};
    const description = [vehicle.color, vehicle.model].filter(Boolean).join(' ');
    return [description, vehicle.plate].filter(Boolean).join(' · ') || '차량 정보 미등록';
}

function updateChatBadges() {
    const count = state.chats.length;
    const badge = document.getElementById('chat-badge');
    if (badge) {
        badge.textContent = count;
        badge.classList.toggle('hidden', count === 0);
    }
    const countLabel = document.querySelector('#chat-list-panel .rounded-full');
    if (countLabel) countLabel.textContent = `${count}개`;
}

// Kakao Map 객체 인스턴스 전역 변수
let hostMapInstance = null;
let hostLeafletMap = null;
let hostMapProvider = null;
let hostMarkers = [];
let hostPolyline = null;
let hostLeafletMarkers = [];
let hostLeafletPolyline = null;
let hostMapSelectionTarget = 'dest';
let mapSelectionRequestId = 0;
let photonRequestQueue = Promise.resolve();
let lastPhotonRequestAt = 0;
let hostRouteRequestId = 0;
let hostRoadRouteDistanceKm = null;
let hostRoadRouteSource = null;
let hostRouteLookupPending = false;
let hostTollEstimateSource = 'pending';

// DOM 로드 시 초기화
document.addEventListener('DOMContentLoaded', () => {
    loadKakaoMaps();
    const dateInput = document.getElementById('search-date');
    const today = new Date();
    dateInput.min = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
    const departureInput = document.getElementById('host-time');
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    departureInput.min = now.toISOString().slice(0, 16);
    document.getElementById('host-origin').addEventListener('input', () => clearHostLocation('origin'));
    document.getElementById('host-dest').addEventListener('input', () => clearHostLocation('dest'));
    document.getElementById('host-time').addEventListener('input', refreshPricingAvailability);
    renderProfile();
    renderRides(state.rides);
    renderChatThreads();
    renderActiveChat();
    updateChatBadges();
    calculateCostCap();
    refreshPricingAvailability();
    document.addEventListener('keydown', event => {
        if (event.key === 'Escape') {
            document.querySelectorAll('[id^="modal-"]').forEach(modal => modal.classList.add('hidden'));
        }
    });
});

function loadKakaoMaps() {
    const key = window.HITCHONE_KAKAO_KEY;
    if (!key) return;
    const script = document.createElement('script');
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(key)}&libraries=services&autoload=false`;
    script.onload = () => kakao.maps.load(() => {
        if (state.currentTab === 'host') initHostMap();
    });
    script.onerror = () => {
        const status = document.getElementById('map-route-status');
        if (status) status.textContent = '지도 API를 불러오지 못했습니다. 키와 도메인 설정을 확인하세요.';
    };
    document.head.appendChild(script);
}

function loadKoreanHolidayCalendar() {
    if (koreanHolidayCalendar) return Promise.resolve(koreanHolidayCalendar);
    if (holidayCalendarPromise) return holidayCalendarPromise;

    holidayCalendarPromise = new Promise((resolve, reject) => {
        if (window.Holidays) {
            koreanHolidayCalendar = new window.Holidays('KR');
            koreanHolidayCalendar.setLanguages('ko');
            resolve(koreanHolidayCalendar);
            return;
        }

        const script = document.createElement('script');
        script.src = 'https://unpkg.com/date-holidays@3.37.0/dist/umd.min.js';
        script.onload = () => {
            try {
                if (!window.Holidays) throw new Error('공휴일 달력을 불러오지 못했습니다.');
                koreanHolidayCalendar = new window.Holidays('KR');
                koreanHolidayCalendar.setLanguages('ko');
                resolve(koreanHolidayCalendar);
            } catch (error) {
                reject(error);
            }
        };
        script.onerror = () => reject(new Error('공휴일 달력 서버에 연결할 수 없습니다.'));
        document.head.appendChild(script);
    }).catch(error => {
        holidayCalendarPromise = null;
        throw error;
    });

    return holidayCalendarPromise;
}

async function getFareEligibility(dateTimeValue) {
    if (!dateTimeValue) return { allowed: false, reason: '출발 일시를 선택해 주세요.' };
    const [date, time] = dateTimeValue.split('T');
    if (!date || !time) return { allowed: false, reason: '출발 일시를 확인해 주세요.' };

    const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
    if (weekday === 0 || weekday === 6) {
        return { allowed: true, reason: '주말에는 시간 제한 없이 유료 모집이 가능합니다.' };
    }

    const [hour, minute] = time.split(':').map(Number);
    const minutes = hour * 60 + minute;
    const isCommuteTime = (minutes >= 7 * 60 && minutes < 9 * 60) || (minutes >= 18 * 60 && minutes < 21 * 60);

    try {
        const calendar = await loadKoreanHolidayCalendar();
        const holiday = calendar.getHolidays(Number(date.slice(0, 4)))
            .find(item => item.type === 'public' && item.date.slice(0, 10) === date);
        if (holiday) return { allowed: true, reason: `${holiday.name} 공휴일에는 시간 제한 없이 유료 모집이 가능합니다.` };
        if (!isCommuteTime) {
            return { allowed: false, reason: '일반 평일은 07:00–09:00, 18:00–21:00에만 유료 모집이 가능합니다.' };
        }
        return { allowed: true, reason: '평일 출퇴근 시간대로 유료 모집이 가능합니다.' };
    } catch (error) {
        console.warn('공휴일 여부를 확인하지 못했습니다.', error);
        return { allowed: false, reason: '공휴일 여부를 확인할 수 없어 유료 등록이 제한됩니다. 무료로 등록할 수 있습니다.' };
    }
}

async function refreshPricingAvailability() {
    const sequence = ++pricingCheckSequence;
    const priceInput = document.getElementById('host-price');
    const status = document.getElementById('pricing-status');
    priceInput.disabled = true;
    status.textContent = '유료 가능 여부를 확인하고 있습니다...';

    const eligibility = await getFareEligibility(document.getElementById('host-time').value);
    if (sequence !== pricingCheckSequence) return;

    priceInput.disabled = !eligibility.allowed;
    if (!eligibility.allowed) priceInput.value = '0';
    priceInput.max = eligibility.allowed ? priceInput.max : 0;
    status.textContent = eligibility.reason;
    status.className = `mt-1 text-xs ${eligibility.allowed ? 'text-green-700' : 'text-amber-700'}`;
    calculateCostCap();
}

function clearHostLocation(type) {
    hostRouteRequestId += 1;
    hostRouteLookupPending = false;
    hostRoadRouteDistanceKm = null;
    hostRoadRouteSource = null;
    hostLocationCoords[type] = null;
    document.getElementById('calc-dist').value = 0;
    document.getElementById('calc-toll').value = 0;
    hostTollEstimateSource = 'pending';
    document.getElementById('toll-estimate-status').textContent = '출발지·도착지 선택 후 통행료를 자동 조회합니다.';
    calculateCostCap();
    clearHostMapOverlays();
    const status = document.getElementById('map-route-status');
    if (status) status.textContent = '주소가 변경되었습니다. 다시 조회해 주세요.';
}

// 탭 전환
function switchTab(tabName) {
    state.currentTab = tabName;
    
    document.querySelectorAll('.tab-content').forEach(el => el.classList.add('hidden'));
    document.getElementById(`tab-${tabName}`).classList.remove('hidden');

    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('text-yellow-600', 'bg-yellow-50', 'font-bold');
        btn.classList.add('text-gray-600');
    });

    const activeNav = document.getElementById(`nav-${tabName}`);
    if (activeNav) {
        activeNav.classList.add('text-yellow-600', 'bg-yellow-50', 'font-bold');
        activeNav.classList.remove('text-gray-600');
    }

    if (tabName === 'profile') {
        renderProfile();
    } else if (tabName === 'host') {
        setTimeout(initHostMap, 200); // 탭 전환 후 지도 DOM 렌더링 지연 호출
    }
}

// -------------------------------------------------------------
// 지도(Kakao Map API) 연동 핵심 로직
// -------------------------------------------------------------

// 1. 모집글 작성용 카카오 지도 초기화
function initHostMap() {
    const container = document.getElementById('host-map');
    if (!container) return;

    if (typeof kakao !== 'undefined' && kakao.maps) {
        if (hostMapInstance) {
            kakao.maps.event.trigger(hostMapInstance, 'resize');
            return;
        }
        if (hostLeafletMap) {
            hostLeafletMap.remove();
            hostLeafletMap = null;
        }
        hostMapProvider = 'kakao';
        const options = {
            center: new kakao.maps.LatLng(36.5, 127.8), // 대한민국 중심점 기본값
            level: 12
        };
        container.innerHTML = '';
        hostMapInstance = new kakao.maps.Map(container, options);
        kakao.maps.event.addListener(hostMapInstance, 'click', event => {
            pickLocationFromMap(event.latLng.getLat(), event.latLng.getLng());
        });
    } else if (window.L) {
        if (hostLeafletMap) {
            setTimeout(() => hostLeafletMap.invalidateSize(), 0);
            return;
        }
        hostMapProvider = 'leaflet';
        container.innerHTML = '';
        hostLeafletMap = window.L.map(container).setView([36.5, 127.8], 7);
        const tileLayer = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            maxZoom: 19,
            attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
        }).addTo(hostLeafletMap);
        tileLayer.on('tileerror', () => {
            document.getElementById('map-route-status').textContent = '지도 이미지를 불러오지 못했습니다. 인터넷 연결을 확인해 주세요.';
        });
        hostLeafletMap.on('click', event => pickLocationFromMap(event.latlng.lat, event.latlng.lng));
        setTimeout(() => hostLeafletMap.invalidateSize(), 0);
        document.getElementById('map-route-status').textContent = '지도를 클릭해 도착지 또는 출발지를 선택하세요.';
    } else {
        container.innerHTML = `
        <div class="w-full h-full bg-slate-800 text-white p-4 flex flex-col items-center justify-center text-center space-y-2">
                <i class="fa-solid fa-map-location-dot text-2xl text-yellow-400"></i>
                <div class="font-bold text-xs">지도를 불러오지 못했습니다</div>
                <div class="text-[11px] text-gray-300">인터넷 연결을 확인한 후 새로고침해 주세요.</div>
            </div>
        `;
    }
}

// 2. 주소 검색 및 좌표 변환 / 경로 그리기
function searchLocationAndPlot(type) {
    const inputId = type === 'origin' ? 'host-origin' : 'host-dest';
    const address = document.getElementById(inputId).value.trim();

    if (!address) {
        alert("지역명을 입력해 주세요 (예: 서울역, 대전 서구, 부산 해운대)");
        return;
    }

    const statusEl = document.getElementById('map-route-status');
    statusEl.textContent = "주소를 조회하고 있습니다...";

    if (typeof kakao !== 'undefined' && kakao.maps && kakao.maps.services) {
        const geocoder = new kakao.maps.services.Geocoder();
        geocoder.addressSearch(address, function(result, status) {
            if (status === kakao.maps.services.Status.OK) {
                const coords = new kakao.maps.LatLng(result[0].y, result[0].x);
                updateHostRouteMap(coords, type, address);
            } else {
                // 주소 검색 실패 시 키워드 장소 검색으로 2차 시도
                const ps = new kakao.maps.services.Places();
                ps.keywordSearch(address, function(data, pStatus) {
                    if (pStatus === kakao.maps.services.Status.OK) {
                        const coords = new kakao.maps.LatLng(data[0].y, data[0].x);
                        updateHostRouteMap(coords, type, address);
                    } else {
                        statusEl.textContent = '주소를 찾지 못했습니다. 도로명 주소나 주변 장소를 입력해 주세요.';
                    }
                });
            }
        });
    } else {
        searchLocationWithPhoton(address, type);
    }
}

function setMapSelectionTarget(type) {
    hostMapSelectionTarget = type === 'origin' ? 'origin' : 'dest';
    const originButton = document.getElementById('map-select-origin');
    const destButton = document.getElementById('map-select-dest');
    originButton.setAttribute('aria-pressed', String(hostMapSelectionTarget === 'origin'));
    destButton.setAttribute('aria-pressed', String(hostMapSelectionTarget === 'dest'));
    originButton.className = `px-2.5 py-1 rounded-lg font-semibold ${hostMapSelectionTarget === 'origin' ? 'bg-yellow-400 text-gray-900' : 'bg-gray-100 text-gray-600'}`;
    destButton.className = `px-2.5 py-1 rounded-lg font-semibold ${hostMapSelectionTarget === 'dest' ? 'bg-yellow-400 text-gray-900' : 'bg-gray-100 text-gray-600'}`;
    document.getElementById('map-route-status').textContent = `지도에서 클릭할 위치: ${hostMapSelectionTarget === 'origin' ? '출발지' : '도착지'}`;
}

function photonRequest(url) {
    const request = photonRequestQueue.then(async () => {
        const wait = Math.max(0, 1100 - (Date.now() - lastPhotonRequestAt));
        if (wait) await new Promise(resolve => setTimeout(resolve, wait));
        lastPhotonRequestAt = Date.now();
        const response = await fetch(url);
        if (!response.ok) throw new Error('주소 검색 서비스에 연결할 수 없습니다.');
        return response.json();
    });
    photonRequestQueue = request.catch(() => {});
    return request;
}

function formatPhotonAddress(feature) {
    const address = feature?.properties || {};
    const area = address.city || address.district || address.county || address.state;
    const street = [address.street || address.name, address.housenumber].filter(Boolean).join(' ');
    return [area, street].filter((value, index, values) => value && values.indexOf(value) === index).join(' ') || address.name || address.country || '';
}

async function searchLocationWithPhoton(address, type) {
    const status = document.getElementById('map-route-status');
    status.textContent = '주소를 검색하고 있습니다...';
    try {
        const url = `https://photon.komoot.io/api/?q=${encodeURIComponent(address)}&limit=1&lat=36.5&lon=127.8`;
        const data = await photonRequest(url);
        const feature = data.features?.[0];
        if (!feature) throw new Error('주소를 찾지 못했습니다.');
        const [lng, lat] = feature.geometry.coordinates;
        const label = address || formatPhotonAddress(feature);
        document.getElementById(type === 'origin' ? 'host-origin' : 'host-dest').value = label;
        if (hostLeafletMap) hostLeafletMap.setView([lat, lng], 13);
        updateHostRouteMap({ lat, lng }, type, label);
    } catch (error) {
        status.textContent = `${error.message || '주소를 찾지 못했습니다.'} 장소명이나 도로명 주소로 다시 시도해 주세요.`;
    }
}

async function pickLocationFromMap(lat, lng) {
    const type = hostMapSelectionTarget;
    const requestId = ++mapSelectionRequestId;
    const status = document.getElementById('map-route-status');
    status.textContent = `${type === 'origin' ? '출발지' : '도착지'} 주소를 확인하고 있습니다...`;
    try {
        const url = `https://photon.komoot.io/reverse?lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lng)}`;
        const data = await photonRequest(url);
        if (requestId !== mapSelectionRequestId) return;
        const feature = data.features?.[0];
        const label = formatPhotonAddress(feature);
        if (!feature || !label) throw new Error('선택한 위치의 주소를 찾지 못했습니다.');
        document.getElementById(type === 'origin' ? 'host-origin' : 'host-dest').value = label;
        updateHostRouteMap({ lat, lng }, type, label);
    } catch (error) {
        if (requestId === mapSelectionRequestId) {
            status.textContent = `${error.message || '주소를 찾지 못했습니다.'} 지도에서 가까운 도로를 다시 선택해 주세요.`;
        }
    }
}

// 3. 지도 위에 핀 마커 및 Polyline (경로선) 그리기
function updateHostRouteMap(coords, type, label) {
    if (!hostMapInstance && !hostLeafletMap) return;
    const requestId = ++hostRouteRequestId;
    hostRouteLookupPending = false;
    hostRoadRouteDistanceKm = null;
    hostRoadRouteSource = null;
    document.getElementById('calc-dist').value = 0;
    document.getElementById('calc-toll').value = 0;
    hostTollEstimateSource = 'pending';
    document.getElementById('toll-estimate-status').textContent = '출발지·도착지 선택 후 통행료를 자동 조회합니다.';
    calculateCostCap();

    const coordinate = {
        lat: typeof coords.getLat === 'function' ? coords.getLat() : Number(coords.lat),
        lng: typeof coords.getLng === 'function' ? coords.getLng() : Number(coords.lng)
    };
    if (type === 'origin') hostLocationCoords.origin = coordinate;
    else hostLocationCoords.dest = coordinate;

    clearHostMapOverlays();
    const other = type === 'origin' ? hostLocationCoords.dest : hostLocationCoords.origin;
    const points = other ? [hostLocationCoords.origin, hostLocationCoords.dest] : [coordinate];

    if (hostMapProvider === 'kakao' && hostMapInstance) {
        const kakaoPoints = points.map(point => new kakao.maps.LatLng(point.lat, point.lng));
        kakaoPoints.forEach(point => hostMarkers.push(new kakao.maps.Marker({ position: point, map: hostMapInstance })));
        if (kakaoPoints.length > 1) {
            const bounds = new kakao.maps.LatLngBounds();
            kakaoPoints.forEach(point => bounds.extend(point));
            hostMapInstance.setBounds(bounds);
        } else {
            hostMapInstance.setCenter(kakaoPoints[0]);
            hostMapInstance.setLevel(5);
        }
    } else if (hostMapProvider === 'leaflet' && hostLeafletMap) {
        const leafletPoints = points.map(point => [point.lat, point.lng]);
        leafletPoints.forEach(point => hostLeafletMarkers.push(window.L.marker(point).addTo(hostLeafletMap)));
        if (leafletPoints.length > 1) {
            hostLeafletMap.fitBounds(window.L.latLngBounds(leafletPoints), { padding: [24, 24] });
        } else {
            hostLeafletMap.setView(leafletPoints[0], 13);
        }
    }

    if (other) {
        hostRouteLookupPending = true;
        document.getElementById('map-route-status').textContent = '실제 자동차 주행 경로와 거리를 조회하고 있습니다...';
        lookupDrivingRoute(requestId);
    } else {
        document.getElementById('map-route-status').textContent = `${label} 위치를 설정했습니다. 반대편 위치도 선택해 주세요.`;
    }
}

function clearHostMapOverlays() {
    hostMarkers.forEach(marker => marker.setMap(null));
    hostMarkers = [];
    if (hostPolyline) hostPolyline.setMap(null);
    hostPolyline = null;
    if (hostLeafletMap) {
        hostLeafletMarkers.forEach(marker => hostLeafletMap.removeLayer(marker));
        hostLeafletMarkers = [];
        if (hostLeafletPolyline) hostLeafletMap.removeLayer(hostLeafletPolyline);
        hostLeafletPolyline = null;
    }
}

async function lookupDrivingRoute(requestId) {
    const origin = hostLocationCoords.origin;
    const destination = hostLocationCoords.dest;
    if (!origin || !destination) return;

    let route;
    let source = 'OpenStreetMap/OSRM';
    let fallbackNote = '';
    const tmapKey = String(window.HITCHONE_TMAP_APP_KEY || '').trim();

    if (tmapKey) {
        try {
            route = await fetchTmapDrivingRoute(origin, destination, tmapKey);
            source = 'Tmap';
        } catch (error) {
            console.warn('Tmap 경로 조회에 실패해 OSRM으로 재시도합니다.', error);
            fallbackNote = 'Tmap 연결 실패 · ';
        }
    }

    if (!route) {
        try {
            route = await fetchOsrmDrivingRoute(origin, destination);
        } catch (error) {
            console.warn('실제 도로 경로를 조회하지 못했습니다.', error);
            if (requestId === hostRouteRequestId) {
                hostRouteLookupPending = false;
                document.getElementById('map-route-status').textContent = '실제 주행경로 조회에 실패했습니다. 이동거리를 직접 입력해 주세요.';
                document.getElementById('toll-estimate-status').textContent = '통행료 자동 조회에 실패했습니다. 직접 입력해 주세요.';
            }
            return;
        }
    }

    if (requestId !== hostRouteRequestId) return;
    hostRouteLookupPending = false;
    const distanceKm = Math.round(route.distanceMeters / 100) / 10;
    hostRoadRouteDistanceKm = distanceKm;
    hostRoadRouteSource = source;
    document.getElementById('calc-dist').value = distanceKm;
    let tollFare = Number.isFinite(Number(route.tollFare)) && route.tollFare !== null ? Number(route.tollFare) : null;
    if (tollFare === null) {
        tollFare = estimateTollFare(distanceKm);
        hostTollEstimateSource = 'distance-estimate';
        document.getElementById('calc-toll').value = tollFare;
        document.getElementById('toll-estimate-status').textContent = `${source} 경로 거리 기준 참고 통행료 추정: ${tollFare.toLocaleString()}원 (실제 톨게이트 요금과 다를 수 있음)`;
    } else {
        hostTollEstimateSource = 'tmap';
        document.getElementById('calc-toll').value = Math.round(tollFare);
        document.getElementById('toll-estimate-status').textContent = `Tmap 경로 응답 통행료: ${Math.round(tollFare).toLocaleString()}원`;
    }
    if (route.coordinates.length > 1) drawDrivingRoute(route.coordinates);
    const duration = route.durationSeconds ? ` · 예상 ${formatRouteDuration(route.durationSeconds)}` : '';
    document.getElementById('map-route-status').textContent = `${fallbackNote}${source} 실제 도로 거리 ${distanceKm.toLocaleString()}km${duration} · 실시간 교통은 미포함`;
    calculateCostCap();
}

async function fetchTmapDrivingRoute(origin, destination, appKey) {
    const response = await fetchWithTimeout('https://apis.openapi.sk.com/tmap/routes?version=1&format=json', {
        method: 'POST',
        headers: {
            appKey,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            startX: String(origin.lng),
            startY: String(origin.lat),
            endX: String(destination.lng),
            endY: String(destination.lat),
            reqCoordType: 'WGS84GEO',
            resCoordType: 'WGS84GEO',
            searchOption: '0',
            trafficInfo: 'N'
        })
    });
    if (!response.ok) throw new Error(`Tmap HTTP ${response.status}`);
    const data = await response.json();
    const features = Array.isArray(data.features) ? data.features : [];
    const properties = features.map(feature => feature.properties || {}).find(item => Number(item.totalDistance) > 0) || {};
    const coordinates = [];
    features.forEach(feature => {
        const geometry = feature.geometry || {};
        if (geometry.type === 'Point') coordinates.push(geometry.coordinates);
        else if (geometry.type === 'LineString') coordinates.push(...geometry.coordinates);
        else if (geometry.type === 'MultiLineString') geometry.coordinates.forEach(line => coordinates.push(...line));
    });
    const validCoordinates = coordinates.filter(point => Array.isArray(point) && Number.isFinite(Number(point[0])) && Number.isFinite(Number(point[1])))
        .map(point => [Number(point[0]), Number(point[1])]);
    let distanceMeters = Number(properties.totalDistance || data.totalDistance);
    if (!(distanceMeters > 0) && validCoordinates.length > 1) {
        distanceMeters = validCoordinates.slice(1).reduce((total, point, index) => {
            const previous = validCoordinates[index];
            return total + haversineKm({ lat: previous[1], lng: previous[0] }, { lat: point[1], lng: point[0] }) * 1000;
        }, 0);
    }
    if (!(distanceMeters > 0)) throw new Error('Tmap 응답에 경로 거리가 없습니다.');
    const fareProperty = features.map(feature => feature.properties || {})
        .find(item => item.totalFare !== undefined || item.tollFare !== undefined);
    const rawTollFare = fareProperty?.tollFare ?? fareProperty?.totalFare ?? data.tollFare ?? data.totalFare;
    const tollFare = rawTollFare === undefined || rawTollFare === null || rawTollFare === '' ? null : Number(rawTollFare);
    return {
        distanceMeters,
        durationSeconds: Number(properties.totalTime || data.totalTime) || 0,
        tollFare: Number.isFinite(tollFare) && tollFare >= 0 ? tollFare : null,
        coordinates: validCoordinates
    };
}

async function fetchOsrmDrivingRoute(origin, destination) {
    const coordinates = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const url = `https://router.project-osrm.org/route/v1/driving/${coordinates}?overview=full&geometries=geojson&steps=false`;
    const response = await fetchWithTimeout(url);
    if (!response.ok) throw new Error(`OSRM HTTP ${response.status}`);
    const data = await response.json();
    const route = data.routes?.[0];
    if (data.code !== 'Ok' || !route || !(route.distance > 0)) throw new Error('도로 경로를 찾지 못했습니다.');
    return {
        distanceMeters: route.distance,
        durationSeconds: route.duration || 0,
        tollFare: null,
        coordinates: route.geometry?.coordinates || []
    };
}

function estimateTollFare(distanceKm) {
    // Tmap 통행료 응답이 없을 때만 사용하는 승용차 기준 참고 추정치
    return Math.max(0, Math.round((1000 + Math.max(0, distanceKm) * 48) / 100) * 100);
}

async function fetchWithTimeout(url, options = {}, timeoutMs = 12000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } finally {
        clearTimeout(timeoutId);
    }
}

function drawDrivingRoute(coordinates) {
    if (hostPolyline) hostPolyline.setMap(null);
    hostPolyline = null;
    if (hostLeafletMap && hostLeafletPolyline) hostLeafletMap.removeLayer(hostLeafletPolyline);
    hostLeafletPolyline = null;

    if (hostMapProvider === 'kakao' && hostMapInstance) {
        const path = coordinates.map(([lng, lat]) => new kakao.maps.LatLng(lat, lng));
        hostPolyline = new kakao.maps.Polyline({ path, strokeWeight: 6, strokeColor: '#2563eb', strokeOpacity: 0.9, strokeStyle: 'solid' });
        hostPolyline.setMap(hostMapInstance);
        const bounds = new kakao.maps.LatLngBounds();
        path.forEach(point => bounds.extend(point));
        hostMapInstance.setBounds(bounds);
    } else if (hostMapProvider === 'leaflet' && hostLeafletMap) {
        const path = coordinates.map(([lng, lat]) => [lat, lng]);
        hostLeafletPolyline = window.L.polyline(path, { color: '#2563eb', weight: 6, opacity: 0.9 }).addTo(hostLeafletMap);
        hostLeafletMap.fitBounds(hostLeafletPolyline.getBounds(), { padding: [24, 24] });
    }
}

function formatRouteDuration(durationSeconds) {
    const minutes = Math.round(durationSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return hours ? `${hours}시간 ${remainingMinutes}분` : `${remainingMinutes}분`;
}

const hostLocationCoords = { origin: null, dest: null };

function haversineKm(origin, dest) {
    const radians = degrees => degrees * Math.PI / 180;
    const latDiff = radians(dest.lat - origin.lat);
    const lngDiff = radians(dest.lng - origin.lng);
    const a = Math.sin(latDiff / 2) ** 2 + Math.cos(radians(origin.lat)) * Math.cos(radians(dest.lat)) * Math.sin(lngDiff / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 5. 카풀 상세 보기 모달 내 카카오 지도 경로 시각화
function renderDetailMap(ride) {
    const container = document.getElementById('detail-map');
    if (!container) return;

    if (typeof kakao !== 'undefined' && kakao.maps && ride.originCoords && ride.destCoords) {
        container.innerHTML = '';
        const map = new kakao.maps.Map(container, {
            center: new kakao.maps.LatLng(ride.originCoords.lat, ride.originCoords.lng),
            level: 11
        });

        const originLatLng = new kakao.maps.LatLng(ride.originCoords.lat, ride.originCoords.lng);
        const destLatLng = new kakao.maps.LatLng(ride.destCoords.lat, ride.destCoords.lng);

        // 출발지 마커
        new kakao.maps.Marker({ position: originLatLng, map: map });
        // 도착지 마커
        new kakao.maps.Marker({ position: destLatLng, map: map });

        // 경로선 Polyline
        const linePath = [originLatLng];
        (ride.waypointCoords || []).forEach(wp => {
            const wpLatLng = new kakao.maps.LatLng(wp.lat, wp.lng);
            new kakao.maps.Marker({ position: wpLatLng, map: map });
            linePath.push(wpLatLng);
        });
        linePath.push(destLatLng);

        const polyline = new kakao.maps.Polyline({
            path: linePath,
            strokeWeight: 5,
            strokeColor: '#f59e0b',
            strokeOpacity: 0.8,
            strokeStyle: 'solid'
        });
        polyline.setMap(map);

    } else {
        // SDK 미로드 시 모의 시각화 컴포넌트
        container.innerHTML = `
            <div class="w-full h-full bg-slate-900 text-white p-4 flex flex-col justify-between relative">
                <div class="flex justify-between items-center z-10">
                    <span class="bg-yellow-400 text-gray-900 text-[10px] font-black px-2 py-0.5 rounded">노선 요약</span>
                    <span class="text-[11px] text-gray-300">실시간 주행 안내 아님</span>
                </div>
                <div class="flex items-center justify-between px-6 z-10">
                    <div class="text-center">
                        <div class="w-8 h-8 bg-blue-600 rounded-full flex items-center justify-center font-bold text-xs mx-auto mb-1">출발</div>
                        <div class="text-xs font-bold">${escapeHTML(ride.origin)}</div>
                    </div>
                    <div class="flex-1 border-t-2 border-dashed border-yellow-400 mx-3 relative flex items-center justify-center">
                        ${ride.waypoints?.length ? `<span class="bg-yellow-500 text-gray-900 text-[9px] font-bold px-1.5 py-0.5 rounded-full absolute -top-2.5">경유: ${escapeHTML(ride.waypoints[0])}</span>` : ''}
                    </div>
                    <div class="text-center">
                        <div class="w-8 h-8 bg-red-600 rounded-full flex items-center justify-center font-bold text-xs mx-auto mb-1">도착</div>
                        <div class="text-xs font-bold">${escapeHTML(ride.destination)}</div>
                    </div>
                </div>
                <div class="text-[10px] text-gray-400 text-right z-10">정확한 위치는 등록자가 조회한 경우에만 표시됩니다</div>
            </div>
        `;
    }
}

// -------------------------------------------------------------
// 마이페이지 / 프로필 / 리뷰 / 계산기 기존 핸들러
// -------------------------------------------------------------
function renderProfile() {
    const user = state.user;
    document.getElementById('profile-display-name').textContent = user.name;
    document.getElementById('profile-display-img').src = user.profileImg;
    document.getElementById('profile-display-phone').textContent = user.phone;
    document.getElementById('profile-display-car').textContent = getVehicleInfo(user);

    const tempValueEl = document.getElementById('manner-temp-value');
    const tempBadgeEl = document.getElementById('manner-temp-badge');
    const tempBarEl = document.getElementById('manner-temp-bar');

    tempValueEl.textContent = `${user.mannerTemp.toFixed(1)}°C`;
    tempBarEl.style.width = `${Math.min(user.mannerTemp, 100)}%`;
    document.getElementById('manner-temp-badge').textContent = user.mannerTemp >= 50 ? '😊 따뜻함' : '🙂 좋은 매너';
    document.getElementById('profile-badge-driver').classList.toggle('hidden', !user.isDriver);

    const tagsContainer = document.getElementById('manner-tags-container');
    tagsContainer.innerHTML = '';
    state.mannerTags.forEach(t => {
        const tagEl = document.createElement('span');
        tagEl.className = "bg-gray-100 hover:bg-gray-200 text-gray-800 text-xs font-medium px-2.5 py-1 rounded-lg flex items-center gap-1.5 transition-colors";
        tagEl.innerHTML = `<span>${escapeHTML(t.label)}</span> <strong class="text-yellow-600 font-bold">${Number(t.count) || 0}</strong>`;
        tagsContainer.appendChild(tagEl);
    });

    const reviewListContainer = document.getElementById('review-list');
    document.getElementById('review-count-badge').textContent = `${state.reviews.length}개`;
    const avgScore = state.reviews.length ? (state.reviews.reduce((acc, r) => acc + r.score, 0) / state.reviews.length).toFixed(1) : '0.0';
    document.getElementById('review-avg-score').textContent = isNaN(avgScore) ? "0.0" : avgScore;

    reviewListContainer.innerHTML = '';
    state.reviews.forEach(review => {
        const item = document.createElement('div');
        item.className = "pt-3 first:pt-0 space-y-2";
        item.innerHTML = `
            <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                    <img src="${escapeHTML(review.evaluatorImg)}" alt="" class="w-8 h-8 rounded-full object-cover">
                    <div>
                        <div class="font-bold text-xs text-gray-900">${escapeHTML(review.evaluatorName)}</div>
                        <div class="text-[10px] text-gray-400">${escapeHTML(review.route)} • ${escapeHTML(review.date)}</div>
                    </div>
                </div>
                <div class="text-xs font-bold text-yellow-500 flex items-center gap-1">
                    <i class="fa-solid fa-star"></i>
                    <span>${(Number(review.score) || 0).toFixed(1)}</span>
                </div>
            </div>
            <p class="text-xs text-gray-700 leading-relaxed">${escapeHTML(review.comment)}</p>
        `;
        reviewListContainer.appendChild(item);
    });
}

function calculateCostCap() {
    const toll = Math.max(0, Number(document.getElementById('calc-toll').value) || 0);
    const dist = Math.max(0, Number(document.getElementById('calc-dist').value) || 0);
    const eff = Math.max(1, Number(document.getElementById('calc-eff').value) || 12);
    const seats = parseInt(document.getElementById('host-seats').value) || 1;
    const avgFuelPrice = 1650;

    const fuelCost = (dist / eff) * avgFuelPrice;
    const totalCost = toll + fuelCost;
    const maxPerPerson = Math.floor(totalCost / (seats + 1));

    document.getElementById('cost-cap-result').textContent = maxPerPerson.toLocaleString() + '원';
    const priceInput = document.getElementById('host-price');
    priceInput.max = maxPerPerson;
    priceInput.setCustomValidity(priceInput.value && Number(priceInput.value) > maxPerPerson ? `예상 비용 ${maxPerPerson.toLocaleString()}원 이하로 입력해 주세요.` : '');
}

function handleTollInput() {
    hostTollEstimateSource = 'manual';
    document.getElementById('toll-estimate-status').textContent = '통행료를 직접 입력한 금액으로 계산합니다.';
    calculateCostCap();
}

async function handleHostSubmit(e) {
    e.preventDefault();
    const origin = document.getElementById('host-origin').value.trim();
    const dest = document.getElementById('host-dest').value.trim();
    const rawTime = document.getElementById('host-time').value;
    const time = rawTime.replace('T', ' ');
    const seats = parseInt(document.getElementById('host-seats').value);
    let price = parseInt(document.getElementById('host-price').value, 10);
    const isFemale = document.getElementById('tag-female').checked;
    if (!rawTime || new Date(rawTime) <= new Date()) {
        alert('출발 일시는 현재 이후로 선택해 주세요.');
        return;
    }
    const fareEligibility = await getFareEligibility(rawTime);
    if (!fareEligibility.allowed) price = 0;
    if (hostLocationCoords.origin && hostLocationCoords.dest && haversineKm(hostLocationCoords.origin, hostLocationCoords.dest) < 1) {
        alert('출발지와 도착지를 다시 확인해 주세요.');
        return;
    }
    if (hostLocationCoords.origin && hostLocationCoords.dest && hostRouteLookupPending) {
        alert('실제 주행 거리를 조회하고 있습니다. 조회가 끝난 후 등록해 주세요.');
        return;
    }
    if (!(Number(document.getElementById('calc-dist').value) > 0)) {
        alert('실제 경로 조회에 실패했으면 주행 거리를 직접 입력해 주세요.');
        return;
    }
    const tags = [...document.querySelectorAll('#host-form input[type="checkbox"]:checked')].map(input => input.value);
    const distanceKm = Math.max(0, Number(document.getElementById('calc-dist').value) || 0);
    let tollFare = Math.max(0, Number(document.getElementById('calc-toll').value) || 0);
    if (hostTollEstimateSource === 'pending') {
        tollFare = estimateTollFare(distanceKm);
        document.getElementById('calc-toll').value = tollFare;
        hostTollEstimateSource = 'distance-estimate';
        document.getElementById('toll-estimate-status').textContent = `거리 기준 참고 통행료 추정: ${tollFare.toLocaleString()}원 (실제 요금과 다를 수 있음)`;
        calculateCostCap();
    }
    const cap = parseInt(document.getElementById('host-price').max, 10) || 0;
    if (fareEligibility.allowed && (!Number.isFinite(price) || price < 0 || price > cap)) {
        alert(`예상 통행료와 유류비를 반영한 분담금 ${cap.toLocaleString()}원 이하로 입력해 주세요.`);
        return;
    }
    const fuelEfficiency = Math.max(1, Number(document.getElementById('calc-eff').value) || 12);
    const estimatedFuelCost = Math.round((distanceKm / fuelEfficiency) * 1650);

    const newRide = {
        id: `ride-${Date.now()}`,
        driverName: state.user.name + " (나)",
        driverImg: state.user.profileImg,
        mannerTemp: state.user.mannerTemp,
        origin: origin,
        originCoords: hostLocationCoords.origin,
        destination: dest,
        destCoords: hostLocationCoords.dest,
        waypoints: [],
        waypointCoords: [],
        departureTime: time,
        distanceKm: hostRoadRouteDistanceKm || distanceKm,
        distanceSource: hostRoadRouteSource || '직접 입력',
        tollFare,
        tollEstimateSource: hostTollEstimateSource,
        estimatedFuelCost,
        estimatedTotalCost: tollFare + estimatedFuelCost,
        seatsLeft: seats,
        totalSeats: seats,
        price: price,
        isFemaleOnly: isFemale,
        tags: [...new Set(tags)],
        carInfo: getVehicleInfo()
    };

    state.rides.unshift(newRide);
    saveState();
    renderRides(state.rides);
    alert(price === 0 ? '무료 탑승 모집글이 등록되었습니다.' : '카풀 모집글이 등록되었습니다!');
    e.target.reset();
    clearHostLocation('origin');
    hostLocationCoords.dest = null;
    calculateCostCap();
    refreshPricingAvailability();
    switchTab('feed');
}

function renderRides(ridesToRender) {
    const container = document.getElementById('ride-list');
    container.innerHTML = '';

    if (!ridesToRender.length) {
        container.innerHTML = '<div class="md:col-span-2 bg-white p-10 rounded-2xl border border-gray-200 text-center text-sm text-gray-500">조건에 맞는 카풀이 없습니다. 검색 조건을 바꾸거나 모집글을 등록해 보세요.</div>';
        return;
    }

    ridesToRender.forEach(ride => {
        const card = document.createElement('div');
        card.className = "bg-white p-5 rounded-2xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer space-y-3";
        card.onclick = () => openRideModal(ride.id);

        card.innerHTML = `
            <div class="flex justify-between items-start">
        <div class="flex items-center gap-2.5">
                    <img src="${escapeHTML(ride.driverImg)}" alt="" class="w-10 h-10 rounded-full object-cover">
                    <div>
                        <div class="font-bold text-sm text-gray-900">${escapeHTML(ride.driverName)}</div>
                        <div class="text-xs text-blue-600 font-semibold">★ 매너온도 ${Number(ride.mannerTemp).toFixed(1)}°C</div>
                        <div class="text-[11px] text-gray-500 mt-0.5"><i class="fa-solid fa-car mr-1"></i>${escapeHTML(ride.carInfo || '차량 정보 미등록')}</div>
                    </div>
                </div>
                ${ride.isFemaleOnly ? '<span class="bg-pink-100 text-pink-700 text-xs px-2.5 py-1 rounded-full font-bold">👩 여성전용</span>' : ''}
            </div>

            <div class="space-y-1">
                <div class="flex items-center gap-2 text-base font-extrabold text-gray-900">
                    <span>${escapeHTML(ride.origin)}</span>
                    <i class="fa-solid fa-arrow-right text-xs text-gray-400"></i>
                    <span>${escapeHTML(ride.destination)}</span>
                </div>
                <div class="text-xs text-gray-500 flex items-center gap-3">
                    <span><i class="fa-regular fa-clock mr-1"></i>${escapeHTML(formatDateTime(ride.departureTime))}</span>
                    <span><i class="fa-solid fa-user-group mr-1"></i>잔여 ${Number(ride.seatsLeft) || 0}/${Number(ride.totalSeats) || 0}석</span>
                    ${Number(ride.distanceKm) > 0 ? `<span><i class="fa-solid fa-road mr-1"></i>주행 ${Number(ride.distanceKm).toLocaleString()}km</span>` : ''}
                </div>
            </div>

            <div class="pt-3 border-t border-gray-100 flex justify-between items-center">
                <div class="flex gap-1">
                    ${(ride.tags || []).map(t => `<span class="bg-gray-100 text-gray-600 text-[11px] px-2 py-0.5 rounded">${escapeHTML(t)}</span>`).join('')}
                </div>
                <div class="text-base font-extrabold text-yellow-900">
                    ${Number(ride.price) > 0 ? `${Number(ride.price).toLocaleString()}원 <span class="text-xs font-normal text-gray-500">/1인</span>` : '<span class="text-green-700">무료 탑승</span>'}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function applyFilter() {
    const origin = document.getElementById('search-origin').value.trim();
    const dest = document.getElementById('search-dest').value.trim();
    const date = document.getElementById('search-date').value;
    const isFemale = document.getElementById('filter-female').checked;

    const filtered = state.rides.filter(r => {
        const matchOrigin = !origin || r.origin.includes(origin);
        const matchDest = !dest || r.destination.includes(dest);
        const matchDate = !date || String(r.departureTime).slice(0, 10) === date;
        const matchFemale = !isFemale || r.isFemaleOnly;
        return matchOrigin && matchDest && matchDate && matchFemale;
    });

    renderRides(filtered);
}

function openRideModal(rideId) {
    const ride = state.rides.find(r => r.id === rideId);
    if (!ride) return;

    state.selectedRideId = rideId;
    const content = document.getElementById('modal-content');

    content.innerHTML = `
        <div class="bg-gray-50 p-3 rounded-xl space-y-1">
            <div class="font-bold text-gray-900">${escapeHTML(ride.origin)} ➔ ${escapeHTML(ride.destination)}</div>
            <div class="text-xs text-gray-500">출발 시각: ${escapeHTML(formatDateTime(ride.departureTime))}</div>
            <div class="text-xs text-gray-500">이용 차량: ${escapeHTML(ride.carInfo || '차량 정보 미등록')}</div>
            ${Number(ride.distanceKm) > 0 ? `<div class="text-xs text-blue-700">${ride.distanceSource === '직접 입력' ? '입력 주행 거리' : '실제 도로 주행 거리'}: ${Number(ride.distanceKm).toLocaleString()}km${ride.distanceSource ? ` (${escapeHTML(ride.distanceSource)})` : ''}</div>` : ''}
            ${Number.isFinite(Number(ride.tollFare)) ? `<div class="text-xs text-gray-600">예상 통행료: ${Number(ride.tollFare).toLocaleString()}원${ride.tollEstimateSource === 'tmap' ? ' (Tmap)' : ride.tollEstimateSource === 'manual' ? ' (직접 입력)' : ' (거리 기준 추정)'}</div><div class="text-xs text-gray-600">예상 유류비: ${Number(ride.estimatedFuelCost || 0).toLocaleString()}원</div><div class="text-xs font-semibold text-gray-700">예상 운행비 합계: ${Number(ride.estimatedTotalCost || 0).toLocaleString()}원</div>` : ''}
        </div>
        <div class="space-y-1">
            <span class="font-bold text-xs text-gray-700">드라이버 정보</span>
            <div class="flex items-center gap-2">
                <img src="${escapeHTML(ride.driverImg)}" alt="" class="w-8 h-8 rounded-full">
                <div>
                    <div class="font-bold text-xs">${escapeHTML(ride.driverName)}</div>
                    <div class="text-[11px] text-blue-600">매너온도 ${Number(ride.mannerTemp).toFixed(1)}°C</div>
                </div>
            </div>
        </div>
        <div class="border-t pt-2 flex justify-between font-bold">
            <span>1인당 분담금</span>
            <span class="${Number(ride.price) > 0 ? 'text-yellow-900' : 'text-green-700'}">${Number(ride.price) > 0 ? `${Number(ride.price).toLocaleString()}원` : '무료 탑승'}</span>
        </div>
    `;

    document.getElementById('modal-ride').classList.remove('hidden');
    const requestButton = document.querySelector('#modal-ride button[onclick="requestRide()"]');
    const isOwnRide = ride.driverName.includes('(나)');
    requestButton.disabled = ride.seatsLeft < 1 || isOwnRide;
    requestButton.textContent = isOwnRide ? '내가 등록한 모집글입니다' : ride.seatsLeft < 1 ? '모집 완료' : Number(ride.price) > 0 ? '동승 신청하기' : '무료 탑승 신청하기';
    requestButton.classList.toggle('opacity-50', requestButton.disabled);
    setTimeout(() => renderDetailMap(ride), 100);
}

function closeModal(modalId) {
    document.getElementById(modalId).classList.add('hidden');
}

function requestRide() {
    const ride = state.rides.find(item => item.id === state.selectedRideId);
    if (!ride || ride.seatsLeft < 1 || ride.driverName.includes('(나)')) return;

    let chat = state.chats.find(item => item.rideId === ride.id);
    if (!chat) {
        chat = {
            id: `chat-${Date.now()}`,
            rideId: ride.id,
            userId: ride.id,
            userName: `${ride.driverName} (운전자)`,
            userImg: ride.driverImg,
            mannerTemp: ride.mannerTemp,
            routeInfo: `${ride.origin} ➔ ${ride.destination} (${String(ride.departureTime).slice(5, 10).replace('-', '/')})`,
            messages: []
        };
        state.chats.unshift(chat);
    }
    chat.messages.push({ sender: 'mine', text: `${ride.origin}에서 ${ride.destination}까지 동승을 신청했습니다.`, time: new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date()) });
    ride.seatsLeft -= 1;
    saveState();
    renderRides(state.rides);
    renderChatThreads();
    updateChatBadges();
    closeModal('modal-ride');
    state.activeChatId = chat.id;
    renderActiveChat();
    switchTab('chat');
    selectChat(chat.id);
}

function openSosModal() {
    document.getElementById('modal-sos').classList.remove('hidden');
    document.getElementById('sos-car-info').textContent = getVehicleInfo();
    if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(position => {
            const lat = position.coords.latitude.toFixed(4);
            const lng = position.coords.longitude.toFixed(4);
            document.getElementById('sos-location').textContent = `현재 위치: 위도 ${lat}, 경도 ${lng}`;
        }, () => {
            document.getElementById('sos-location').textContent = '위치 권한을 확인할 수 없습니다. 주변 표지판을 확인해 112에 알려주세요.';
        });
    } else {
        document.getElementById('sos-location').textContent = '이 브라우저에서는 위치 확인을 지원하지 않습니다. 주변 표지판을 확인해 112에 알려주세요.';
    }
}

// -------------------------------------------------------------
// 프로필 편집 및 기타 모달 핸들러
// -------------------------------------------------------------
let tempAvatarData = null;

function openProfileEditModal() {
    document.getElementById('edit-nickname').value = state.user.name;
    document.getElementById('edit-car-model').value = state.user.vehicle?.model || '';
    document.getElementById('edit-car-color').value = state.user.vehicle?.color || '';
    document.getElementById('edit-car-plate').value = state.user.vehicle?.plate || '';
    document.getElementById('edit-avatar-preview').src = state.user.profileImg;
    tempAvatarData = state.user.profileImg;
    document.getElementById('edit-avatar-url').value = '';
    document.getElementById('modal-profile-edit').classList.remove('hidden');
}

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (file) {
        if (!file.type.startsWith('image/') || file.size > 1024 * 1024) {
            alert('이미지 파일은 1MB 이하만 업로드할 수 있습니다.');
            e.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = function(evt) {
            tempAvatarData = evt.target.result;
            document.getElementById('edit-avatar-preview').src = tempAvatarData;
        };
        reader.readAsDataURL(file);
    }
}

function previewUrlImage(url) {
    if (url.trim()) {
        tempAvatarData = url.trim();
        document.getElementById('edit-avatar-preview').src = tempAvatarData;
    }
}

function useDefaultAvatar() {
    tempAvatarData = "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=150";
    document.getElementById('edit-avatar-preview').src = tempAvatarData;
    document.getElementById('edit-avatar-url').value = '';
}

function handleProfileSave(e) {
    e.preventDefault();
    const newName = document.getElementById('edit-nickname').value.trim();
    if (!newName) return;

    state.user.name = newName;
    state.user.profileImg = tempAvatarData;
    state.user.vehicle = {
        model: document.getElementById('edit-car-model').value.trim(),
        color: document.getElementById('edit-car-color').value.trim(),
        plate: document.getElementById('edit-car-plate').value.trim()
    };
    state.rides.forEach(ride => {
        if (ride.driverName.endsWith('(나)')) {
            ride.driverName = `${newName} (나)`;
            ride.driverImg = tempAvatarData;
            ride.carInfo = getVehicleInfo();
        }
    });

    saveState();
    renderProfile();
    renderRides(state.rides);
    closeModal('modal-profile-edit');
    alert("프로필이 성공적으로 업데이트되었습니다!");
}

function renderChatThreads() {
    const container = document.getElementById('chat-threads');
    container.innerHTML = '';

    state.chats.forEach(chat => {
        const lastMsg = chat.messages[chat.messages.length - 1];
        const item = document.createElement('div');
        item.className = `p-3.5 flex items-center gap-3 cursor-pointer hover:bg-gray-100 transition-colors ${chat.id === state.activeChatId ? 'bg-yellow-50/60' : ''}`;
        item.onclick = () => selectChat(chat.id);

        item.innerHTML = `
                    <img src="${escapeHTML(chat.userImg)}" alt="" class="w-11 h-11 rounded-full object-cover">
            <div class="flex-1 min-w-0">
                <div class="flex justify-between items-baseline">
                    <h4 class="font-bold text-sm text-gray-900 truncate">${escapeHTML(chat.userName)}</h4>
                    <span class="text-[10px] text-gray-400">${lastMsg ? lastMsg.time : ''}</span>
                </div>
                <p class="text-xs text-gray-500 truncate mt-0.5">${lastMsg ? escapeHTML(lastMsg.text) : '대화를 시작하세요'}</p>
            </div>
        `;
        container.appendChild(item);
    });
}

function selectChat(chatId) {
    state.activeChatId = chatId;
    renderChatThreads();
    renderActiveChat();

    document.getElementById('chat-list-panel').classList.add('hidden', 'md:flex');
    document.getElementById('chat-room-panel').classList.remove('hidden');
    document.getElementById('chat-room-panel').classList.add('flex');
}

function backToChatList() {
    document.getElementById('chat-list-panel').classList.remove('hidden');
    document.getElementById('chat-room-panel').classList.add('hidden');
}

function renderActiveChat() {
    const chat = state.chats.find(c => c.id === state.activeChatId);
    if (!chat) return;

    document.getElementById('chat-user-name').textContent = chat.userName;
    document.getElementById('chat-user-img').src = chat.userImg;
    document.getElementById('chat-route-info').textContent = chat.routeInfo;
    document.getElementById('chat-user-temp').textContent = chat.mannerTemp;

    const container = document.getElementById('chat-messages');
    container.innerHTML = '';

    chat.messages.forEach(msg => {
        const isMine = msg.sender === 'mine';
        const wrapper = document.createElement('div');
        wrapper.className = `flex gap-2 ${isMine ? 'justify-end' : 'justify-start'}`;

        wrapper.innerHTML = `
            ${!isMine ? `<img src="${escapeHTML(chat.userImg)}" alt="" class="w-8 h-8 rounded-full object-cover">` : ''}
            <div class="max-w-[70%] space-y-1">
                <div class="p-2.5 text-xs shadow-sm ${isMine ? 'chat-bubble-mine' : 'chat-bubble-other'}">
                    ${escapeHTML(msg.text)}
                </div>
                <div class="text-[9px] text-gray-500 ${isMine ? 'text-right' : 'text-left'}">${msg.time}</div>
            </div>
        `;
        container.appendChild(wrapper);
    });

    container.scrollTop = container.scrollHeight;
}

function handleSendMessage(e) {
    e.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    const chat = state.chats.find(c => c.id === state.activeChatId);
    if (chat) {
        const timeStr = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hour12: true }).format(new Date());
        
        chat.messages.push({
            sender: 'mine',
            text: text,
            time: timeStr
        });

        input.value = '';
        saveState();
        renderActiveChat();
        renderChatThreads();
    }
}
