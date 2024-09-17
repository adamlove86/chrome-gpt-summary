import os
import subprocess

def get_current_version():
    # Get the current version from git tags
    try:
        current_version = subprocess.check_output(['git', 'describe', '--tags'], universal_newlines=True).strip().lstrip('v')
    except subprocess.CalledProcessError:
        current_version = "0.0.0"  # Default to 0.0.0 if no tag is found
    return current_version

def suggest_next_versions(current_version):
    # Split the version into parts, and fill missing parts with 0
    version_parts = current_version.split('.')
    major = int(version_parts[0])
    minor = int(version_parts[1]) if len(version_parts) > 1 else 0
    patch = int(version_parts[2]) if len(version_parts) > 2 else 0

    # Suggest next version options
    suggested_major = f"{major + 1}.0.0"
    suggested_minor = f"{major}.{minor + 1}.0"
    suggested_patch = f"{major}.{minor}.{patch + 1}"

    return suggested_major, suggested_minor, suggested_patch

def read_multiline_input(prompt):
    print(prompt)
    print("Enter your commit message. End with an empty line:")
    lines = []
    while True:
        try:
            line = input()
            if line == '':
                break
            lines.append(line)
        except EOFError:
            break
    return '\n'.join(lines)

def commit_and_push(version, changes):
    # Add all changes
    subprocess.run(['git', 'add', '.'])

    # Commit the changes with the provided message
    commit_message = f'Release v{version}\n\n{changes}'
    subprocess.run(['git', 'commit', '-m', commit_message])

    # Tag the new version
    subprocess.run(['git', 'tag', f'v{version}'])

    # Push the commit and the tag to the remote repository
    subprocess.run(['git', 'push', 'origin', 'main'])
    subprocess.run(['git', 'push', 'origin', f'v{version}'])

def main():
    # Print the current version
    current_version = get_current_version()
    print(f"Current version: v{current_version}")

    # Suggest next versions
    suggested_major, suggested_minor, suggested_patch = suggest_next_versions(current_version)
    print(f"Suggested versions:\n  1. Major version: {suggested_major}\n  2. Minor version: {suggested_minor}\n  3. Patch version: {suggested_patch}")

    # Ask for the new version (use one of the suggestions or enter your own)
    new_version = input(f"Enter the new version (default is {suggested_minor}): ").strip() or suggested_minor

    # Ask for the changes
    changes = read_multiline_input('Enter the changes (plain text code changelog without empty lines or double spacing):')

    # Confirm and commit
    print(f"\nUploading version {new_version} with the following changes:\n{changes}")
    confirm = input("Confirm commit and push? (y/n): ").strip().lower()
    if confirm == 'y':
        commit_and_push(new_version, changes)
        print(f"Version {new_version} uploaded successfully!")
    else:
        print("Commit canceled.")

if __name__ == "__main__":
    main()
