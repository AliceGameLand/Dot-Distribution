# 도트 전용 배포 작업 지침

- 꼬몰리님 다이아의 ID는 `DiamondCK-26.2`, 접속 주소는 `alicehiyam.dreamcraft.kr:25568`이다.
- 런처는 `AliceGameLand/Dot-Launcher`, 배포는 `AliceGameLand/Dot-Distribution`에서 독립 관리한다.
- 원본 앨리스 런처·배포 저장소를 변경하지 않는다. 런타임 URL에 원본 배포 저장소를 참조하지 않는다.
- Donation, Sophisticated Backpacks/Core, 기존 최적화·한글 모드를 유지한다. 미니맵(JourneyMap)은 포함하지 않는다. AliceDiamondClient와 전용 리소스팩은 포함하지 않는다.
- 옵션·Iris 설정·서버 목록은 최초 설치에만 제공한다. 해당 모듈에 MD5를 추가하여 기존 사용자 설정을 덮어쓰지 않는다.
- 기본 설정을 수정하면 `npm run prepare`로 해시를 갱신하고 `npm run verify`를 수행한다. 게시 후 `npm run verify:remote`로 실제 다운로드를 검증한다.
- `.release-assets`는 Git에 넣지 않고 GitHub 릴리스에 게시한다. `distribution.json`은 릴리스 자산으로도 함께 게시한다.
- 공개 README와 저장소 설명은 간단하게 유지하고 인스턴스 세부 설명은 넣지 않는다.
- 커밋 Author와 Committer는 `JooHwan Kim <gptnr2140@gmail.com>`을 사용한다.
