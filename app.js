document.addEventListener('DOMContentLoaded', function () {
    // 네이버 지도 API를 동적으로 로드합니다.
    const script = document.createElement('script');
    script.src = 'https://oapi.map.naver.com/openapi/v3/maps.js?ncpKeyId=rjicj1msgi';
    script.onload = initializeMap;
    document.head.appendChild(script);
});

function initializeMap() {
    let map; // 함수 내에서 map 변수 선언

    const defaultPosition = new naver.maps.LatLng(37.566826, 126.9786567); // 기본 위치: 서울시청

    const mapOptions = {
        center: defaultPosition,
        zoom: 15,
        minZoom: 6,
        zoomControl: true,
        zoomControlOptions: {
            position: naver.maps.Position.TOP_RIGHT
        }
    };

    map = new naver.maps.Map('map', mapOptions);

    // Geolocation API를 사용하여 현재 위치를 가져옵니다.
    if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
            (position) => {
                const lat = position.coords.latitude;
                const lng = position.coords.longitude;
                const userPosition = new naver.maps.LatLng(lat, lng);
                map.setCenter(userPosition); // 지도의 중심을 사용자의 현재 위치로 변경
                map.setZoom(16); // 조금 더 확대
            },
            (error) => {
                console.error("Geolocation error: ", error);
                // 위치 정보를 가져오지 못하면 기본 위치(서울시청)가 그대로 유지됩니다.
            }
        );
    } else {
        console.log("Geolocation is not supported by this browser.");
        // Geolocation을 지원하지 않아도 기본 위치가 그대로 유지됩니다.
    }
} 