import json
import os
import glob

DATA_DIR = "data"
LIST_FILE = os.path.join(DATA_DIR, "_list.json")


def load_list():
    """Загрузить _list.json"""
    if os.path.exists(LIST_FILE):
        with open(LIST_FILE, 'r', encoding='utf-8') as f:
            return json.load(f)
    return []


def save_list(gdps_list):
    """Сохранить _list.json"""
    with open(LIST_FILE, 'w', encoding='utf-8') as f:
        json.dump(gdps_list, f, indent=4, ensure_ascii=False)


def load_level(file_name):
    """Загрузить JSON файл уровня"""
    file_path = os.path.join(DATA_DIR, f"{file_name}.json")
    if os.path.exists(file_path):
        with open(file_path, 'r', encoding='utf-8') as f:
            return json.load(f)
    return None


def save_level(file_name, level_data):
    """Сохранить JSON файл уровня"""
    file_path = os.path.join(DATA_DIR, f"{file_name}.json")
    with open(file_path, 'w', encoding='utf-8') as f:
        json.dump(level_data, f, indent=4, ensure_ascii=False)


def get_all_levels():
    """Получить все уровни из _list.json с их данными"""
    gdps_list = load_list()
    levels = []
    for i, file_name in enumerate(gdps_list):
        level = load_level(file_name)
        if level:
            levels.append((i, file_name, level))
    return levels


def show_levels():
    """Показать список уровней"""
    levels = get_all_levels()
    if not levels:
        print("\n  Лист пуст.")
        return levels
    
    print(f"\n  {'#':<4} {'ID':<8} {'Название':<30} {'Автор':<15} {'Рекорды'}")
    print("  " + "-" * 75)
    for i, file_name, level in levels:
        records_count = len(level.get("records", []))
        print(f"  {i+1:<4} {level.get('id', '?'):<8} {level.get('name', '?'):<30} {level.get('author', '?'):<15} {records_count}")
    
    return levels


def add_level():
    """Добавить новый уровень"""
    print("\n=== Добавление уровня ===\n")
    
    file_name = input("Внутреннее имя файла (например, Bloodbath, без .json): ").strip()
    if not file_name:
        print("[-] Имя файла не может быть пустым.")
        return
    
    # Проверяем, не существует ли уже
    if os.path.exists(os.path.join(DATA_DIR, f"{file_name}.json")):
        print(f"[-] Файл {file_name}.json уже существует!")
        return
    
    level_id = input("ID уровня в игре: ").strip()
    name = input("Название уровня: ").strip()
    author = input("Автор (паблишер): ").strip()
    creators_raw = input("Соавторы (через запятую, пропустить - Enter): ").strip()
    creators = [c.strip() for c in creators_raw.split(',') if c.strip()] if creators_raw else []
    verifier = input("Верификатор: ").strip()
    verification = input("Ссылка на видео верификации: ").strip()
    percent = input("Процент для квалификации (по умолчанию 100): ").strip() or "100"
    password = input("Пароль (по умолчанию Free to copy): ").strip() or "Free to copy"
    
    level_data = {
        "id": int(level_id) if level_id.isdigit() else level_id,
        "name": name,
        "author": author,
        "creators": creators,
        "verifier": verifier,
        "verification": verification,
        "percentToQualify": int(percent) if percent.isdigit() else 100,
        "password": password,
        "records": []
    }
    
    # Сохраняем файл уровня
    save_level(file_name, level_data)
    print(f"\n[+] Файл {file_name}.json создан.")
    
    # Автоматически добавляем в _list.json
    gdps_list = load_list()
    
    if len(gdps_list) == 0:
        gdps_list.append(file_name)
        pos = 1
    else:
        print(f"\nСейчас в листе {len(gdps_list)} уровней.")
        pos_raw = input(f"На какое место поставить? (1-{len(gdps_list)+1}, Enter = в конец): ").strip()
        
        if not pos_raw:
            pos = len(gdps_list) + 1
        else:
            try:
                pos = max(1, min(int(pos_raw), len(gdps_list) + 1))
            except ValueError:
                pos = len(gdps_list) + 1
                print(f"[!] Некорректное число, ставлю в конец.")
        
        gdps_list.insert(pos - 1, file_name)
    
    save_list(gdps_list)
    print(f"[+] {name} добавлен на #{pos} в _list.json.")


def add_record():
    """Добавить рекорд к уровню"""
    print("\n=== Добавление рекорда ===\n")
    
    levels = show_levels()
    if not levels:
        return
    
    # Выбор уровня по ID
    level_input = input("\nВведите ID уровня (число) или номер в листе (#1, #2...): ").strip()
    
    target = None
    target_file = None
    
    if level_input.startswith("#"):
        # По номеру в листе
        try:
            idx = int(level_input[1:]) - 1
            if 0 <= idx < len(levels):
                target = levels[idx]
        except ValueError:
            pass
    else:
        # По ID уровня
        try:
            search_id = int(level_input) if level_input.isdigit() else level_input
            for lvl in levels:
                if lvl[2].get("id") == search_id:
                    target = lvl
                    break
        except ValueError:
            pass
    
    if not target:
        print("[-] Уровень не найден.")
        return
    
    _, file_name, level = target
    print(f"\n  Выбран: {level['name']} (ID: {level['id']})")
    print(f"  Текущих рекордов: {len(level.get('records', []))}")
    
    # Показать текущие рекорды
    if level.get("records"):
        print(f"\n  {'Игрок':<20} {'%':<6} {'Hz':<6} {'Mobile'}")
        print("  " + "-" * 50)
        for rec in level["records"]:
            mobile = "📱" if rec.get("mobile") else ""
            print(f"  {rec['user']:<20} {rec['percent']:<6} {rec.get('hz', '?'):<6} {mobile}")
    
    print("\n--- Новый рекорд ---")
    user = input("Ник игрока: ").strip()
    if not user:
        print("[-] Ник не может быть пустым.")
        return
    
    percent_raw = input("Процент (по умолчанию 100): ").strip() or "100"
    try:
        percent = int(percent_raw)
    except ValueError:
        percent = 100
    
    hz_raw = input("FPS/Hz (по умолчанию 60): ").strip() or "60"
    try:
        hz = int(hz_raw)
    except ValueError:
        hz = 60
    
    link = input("Ссылка на видео: ").strip()
    
    mobile_raw = input("С телефона? (y/n, по умолчанию n): ").strip().lower()
    mobile = mobile_raw in ('y', 'yes', 'д', 'да')
    
    record = {
        "user": user,
        "percent": percent,
        "hz": hz,
        "link": link,
        "mobile": mobile
    }
    
    if "records" not in level:
        level["records"] = []
    
    level["records"].append(record)
    save_level(file_name, level)
    print(f"\n[+] Рекорд {user} ({percent}%) добавлен в {level['name']}!")


def remove_record():
    """Удалить рекорд"""
    print("\n=== Удаление рекорда ===\n")
    
    levels = show_levels()
    if not levels:
        return
    
    level_input = input("\nВведите ID уровня или номер (#1, #2...): ").strip()
    
    target = None
    if level_input.startswith("#"):
        try:
            idx = int(level_input[1:]) - 1
            if 0 <= idx < len(levels):
                target = levels[idx]
        except ValueError:
            pass
    else:
        try:
            search_id = int(level_input) if level_input.isdigit() else level_input
            for lvl in levels:
                if lvl[2].get("id") == search_id:
                    target = lvl
                    break
        except ValueError:
            pass
    
    if not target:
        print("[-] Уровень не найден.")
        return
    
    _, file_name, level = target
    records = level.get("records", [])
    
    if not records:
        print(f"[-] У {level['name']} нет рекордов.")
        return
    
    print(f"\nРекорды {level['name']}:")
    for i, rec in enumerate(records):
        print(f"  {i+1}. {rec['user']} — {rec['percent']}%")
    
    try:
        idx = int(input("\nНомер рекорда для удаления: ").strip()) - 1
        if 0 <= idx < len(records):
            removed = records.pop(idx)
            save_level(file_name, level)
            print(f"[+] Рекорд {removed['user']} удалён.")
        else:
            print("[-] Неверный номер.")
    except ValueError:
        print("[-] Введите число.")


def git_push():
    """Запушить изменения на GitHub"""
    print("\nПушу на GitHub...")
    os.system('cmd /c "cd /d data\\.. & git add -A & git commit -m "Update list" & git push"')
    print("[+] Готово!")


def main():
    print("=" * 50)
    print("       MT List — Менеджер уровней")
    print("=" * 50)
    
    while True:
        print("\n┌─────────────────────────────┐")
        print("│  1. Список уровней          │")
        print("│  2. Добавить уровень        │")
        print("│  3. Добавить рекорд         │")
        print("│  4. Удалить рекорд          │")
        print("│  5. Запушить на GitHub       │")
        print("│  0. Выход                   │")
        print("└─────────────────────────────┘")
        
        choice = input("\nВыбор: ").strip()
        
        if choice == "1":
            show_levels()
        elif choice == "2":
            add_level()
        elif choice == "3":
            add_record()
        elif choice == "4":
            remove_record()
        elif choice == "5":
            git_push()
        elif choice == "0":
            print("\nПока! 👋")
            break
        else:
            print("[-] Неверный выбор.")


if __name__ == "__main__":
    main()
