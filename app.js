// 전역 변수 선언
let map;
let markers = [];
let currentPlaces = []; // 현재 검색 결과를 저장할 배열

document.addEventListener('DOMContentLoaded', function () {
    const KAKAO_JS_KEY = '083df200276ca2cba88ee3db6ebbc2c1';
    
    // 1. 스크립트를 동적으로 생성하고, 로딩이 완료되면 initMap 함수를 호출합니다.
    const script = document.createElement('script');
    script.src = `//dapi.kakao.com/v2/maps/sdk.js?appkey=${KAKAO_JS_KEY}&libraries=services&autoload=false`;
    script.onload = () => {
        kakao.maps.load(() => {
            initMap();
        });
    };
    document.head.appendChild(script);
});

function initMap() {
    // 2. Geolocation API를 사용하여 현재 위치를 먼저 가져옵니다.
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                initializeMap(new kakao.maps.LatLng(lat, lng));
            },
            (error) => {
                console.error("Geolocation error: ", error);
                initializeMap(new kakao.maps.LatLng(37.566826, 126.9786567)); // 기본 위치: 서울시청
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );
    } else {
        console.log("Geolocation is not supported by this browser.");
        initializeMap(new kakao.maps.LatLng(37.566826, 126.9786567));
    }
}

function initializeMap(centerPosition) {
    const mapContainer = document.getElementById('map');
    const mapOptions = {
        center: centerPosition,
        level: 3 // 카카오맵의 확대 레벨
    };
    map = new kakao.maps.Map(mapContainer, mapOptions);

    // 검색 버튼 이벤트 리스너 설정
    document.getElementById('search-btn').addEventListener('click', searchPlaces);

    // 검색창에서 엔터 키 입력 시 검색 실행
    document.getElementById('keyword').addEventListener('keydown', (event) => {
        if (event.key === 'Enter') {
            searchPlaces();
        }
    });

    // 바텀시트 닫기/열기 버튼 이벤트 리스너 설정
    const resultSheet = document.getElementById('result-sheet');
    const closeBtn = document.getElementById('close-sheet-btn');
    const reopenBtn = document.getElementById('reopen-sheet-btn');
    const mainElement = document.querySelector('main');

    closeBtn.addEventListener('click', () => {
        resultSheet.classList.remove('visible');
        reopenBtn.classList.add('visible');
        mainElement.classList.remove('search-active');
    });

    reopenBtn.addEventListener('click', () => {
        resultSheet.classList.add('visible');
        reopenBtn.classList.remove('visible');
        mainElement.classList.add('search-active');
    });
}

async function searchPlaces() {
    // 지도 객체가 준비되지 않았으면 검색을 막습니다.
    if (!map) {
        console.warn("Map is not ready yet.");
        return;
    }

    const keyword = document.getElementById('keyword').value.trim();
    if (!keyword) {
        alert('검색어를 입력해주세요.');
        return;
    }

    const searchBtn = document.getElementById('search-btn');
    searchBtn.disabled = true;
    searchBtn.textContent = '검색 중...';

    // 현재 지도 영역의 좌표를 얻어옵니다.
    const bounds = map.getBounds();
    const sw = bounds.getSouthWest(); // 남서쪽 좌표
    const ne = bounds.getNorthEast(); // 북동쪽 좌표
    const rect = `${sw.getLng()},${sw.getLat()},${ne.getLng()},${ne.getLat()}`;

    try {
        // 불안정한 Rewrite 대신, Function의 직접 URL을 호출하는 안정적인 방식을 사용합니다.
        const response = await fetch(`https://api-762xdud6eq-uc.a.run.app/search?query=${keyword}&rect=${rect}`);
        if (!response.ok) {
            throw new Error('API 호출에 실패했습니다.');
        }
        currentPlaces = await response.json();

        if (currentPlaces.length === 0) {
            alert('검색 결과가 없습니다.');
        }
    } catch (error) {
        console.error('Search error:', error);
        alert('검색 중 오류가 발생했습니다.');
        currentPlaces = [];
    } finally {
        searchBtn.disabled = false;
        searchBtn.textContent = '검색';
    }

    document.getElementById('result-count').textContent = `'${keyword}' 검색 결과 (${currentPlaces.length}개)`;
    document.getElementById('reopen-sheet-btn').textContent = `${keyword}' 검색 결과 (${currentPlaces.length}개)`;
    
    displayPlaces(currentPlaces);

    document.getElementById('result-sheet').classList.add('visible');
    document.getElementById('reopen-sheet-btn').classList.remove('visible');
    document.querySelector('main').classList.add('search-active');
}

function displayPlaces(places) {
    const resultList = document.getElementById('result-list');
    resultList.innerHTML = '';
    removeMarkers();

    if (places.length === 0) {
        resultList.innerHTML = '<div class="no-result">검색 결과가 없습니다.</div>';
        return;
    }

    const bounds = new kakao.maps.LatLngBounds();

    places.forEach(place => {
        const item = document.createElement('div');
        item.className = 'result-item';
        item.innerHTML = `
            <h5>${place.place_name}</h5>
            <p>${place.road_address_name || place.address_name}</p>
        `;

        const position = new kakao.maps.LatLng(place.y, place.x);
        
        item.addEventListener('click', () => {
            map.setCenter(position);
            map.setLevel(3);
        });
        
        addMarker(position, place.place_name);
        bounds.extend(position);
        
        resultList.appendChild(item);
    });

    if (places.length > 0) {
        map.setBounds(bounds);
    }
}

function addMarker(position, title) {
    const marker = new kakao.maps.Marker({
        position: position,
        map: map,
        title: title,
    });
    markers.push(marker);
}

function removeMarkers() {
    markers.forEach(marker => marker.setMap(null));
    markers = [];
} 